import "server-only";
import { prisma } from "../db";
import { generatePostContent } from "../ai";
import { scrapeUrl } from "../scrape";
import { compactSource } from "../compact";
import { renderAndStore, renderSlideAndStore } from "../render";
import { renderVideoAndStore, extractAndStoreMiddleFrame } from "../render/video";
import {
  publishToInstagram,
  publishVideoToInstagram,
  publishCarouselToInstagram,
} from "../instagram";
import { canEditPost, canReviewPost, can } from "../rbac";
import { PURGE_SELECT, purgePostsWithMedia } from "./retention";
import { getAppSettings } from "./settings";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../http";
import { POST_STATUS, PUBLICATION_STATUS, PEER_APPROVALS_NEEDED, type Credit } from "../domain";
import type { z } from "zod";
import type {
  createPostSchema,
  saveArtSchema,
  saveVideoSchema,
  regenerateSchema,
  editVersionSchema,
  addPhotoSchema,
  addVideoSchema,
} from "../validation";
import { Prisma, type User, type PostVersion } from "@prisma/client";
import type { CompactResult } from "../compact";
import { testPostContent } from "../i18n/server-messages";
import { getContentLanguage } from "../language/config";

type CreatePostInput = z.infer<typeof createPostSchema>;
type SaveArtInput = z.infer<typeof saveArtSchema>;
type SaveVideoInput = z.infer<typeof saveVideoSchema>;
type RegenerateInput = z.infer<typeof regenerateSchema>;
type EditVersionInput = z.infer<typeof editVersionSchema>;
type AddPhotoInput = z.infer<typeof addPhotoSchema>;
type AddVideoInput = z.infer<typeof addVideoSchema>;

/** Every post service requires a company — see requireCompanyUser() in lib/auth.ts. */
type CompanyUser = User & { companyId: string };

async function nextVersionNumber(postId: string): Promise<number> {
  const last = await prisma.postVersion.findFirst({
    where: { postId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (last?.versionNumber ?? 0) + 1;
}

async function latestVersion(postId: string): Promise<PostVersion> {
  const v = await prisma.postVersion.findFirst({
    where: { postId },
    orderBy: { versionNumber: "desc" },
  });
  if (!v) throw notFound("Post has no versions.");
  return v;
}

/**
 * Every function below that receives a postId loads the post and calls this
 * before reading canEditPost/canReviewPost — it stops someone from another
 * company from editing/approving/deleting a post just by guessing the UUID
 * (canEditPost/canReviewPost check role and authorship, not company). 404
 * instead of 403 on purpose: it does not even reveal that the post exists to
 * someone from another company.
 */
function assertSameCompany(postCompanyId: string, userCompanyId: string): void {
  if (postCompanyId !== userCompanyId) throw notFound("Post not found.");
}

// ── 1) Create post + AI pipeline (text only) ─────────────────
export async function createPostWithAi(user: CompanyUser, input: CreatePostInput) {
  if (isTestSubmission(input)) return createTestPost(user, input);

  // Links pasted in the middle of the text are sources too: without this,
  // "link1 link2" (or link + note) went to the AI as a bare URL with no
  // content read — it ended up writing about only one of them (or from the
  // URL slug).
  const textUrls = extractUrls(input.text ?? "");
  const urls = [...new Set([input.url, ...textUrls].filter(Boolean) as string[])]
    .slice(0, MAX_LINKS);
  const textWithoutUrls = stripUrls(input.text ?? "");
  let sourceText = textWithoutUrls || null;

  // Supporting material: scraped link(s) and/or attached document (PDF/txt) —
  // goes through the compaction pipeline before the prompt (see compact.ts):
  // a structured document (police report, expert report, statement) keeps only
  // the fields extracted by rule, spending no AI tokens on it; generic text is
  // cut at a tighter cap. Cuts tokens and redacts personal data BEFORE the AI
  // sees it.
  const support: string[] = [];
  const scrapes = await Promise.allSettled(urls.map((u) => scrapeUrl(u)));
  const titles: string[] = [];
  scrapes.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`[scrape] failed ${urls[i]}: ${(r.reason as Error).message}`);
      return;
    }
    // Already published article: names are public and journalistic, do not redact.
    const compacted = compactSource(r.value.content, { keepNames: true });
    logCompaction("link", compacted);
    support.push(
      `[Link ${i + 1} of ${urls.length} (${labelKind(compacted.kind)}): ${urls[i]}]\n${compacted.text}`,
    );
    if (r.value.title) titles.push(r.value.title);
  });
  // No readable link and nothing else to use: same error as before (the first
  // link's), instead of sending the AI to write about a bare URL.
  const firstFailure = scrapes.find((r) => r.status === "rejected");
  if (urls.length && !support.length && !sourceText && !input.document && firstFailure) {
    throw (firstFailure as PromiseRejectedResult).reason;
  }
  // A couple of loose words with no link or document ("oi", "acidente"): there
  // is nothing for the AI to work from, and it would invent the whole story.
  if (!urls.length && !input.document && !sourceText) {
    throw badRequest(
      "The text is too short to write a story. Send at least one sentence about what happened, a link or a document.",
    );
  }
  if (!sourceText && titles.length) sourceText = titles.join("\n");
  if (input.document) {
    const compacted = compactSource(input.document.text);
    logCompaction("document", compacted);
    support.push(
      `[Attached document (${labelKind(compacted.kind)}): ${input.document.name}]\n${compacted.text}`,
    );
  }
  const scrapedContent = support.length ? support.join("\n\n---\n\n") : null;

  // Derived source type (the UI no longer asks).
  const sourceType = urls.length
    ? "link"
    : input.document
      ? "document"
      : input.text
        ? "text"
        : "photo";

  const credits = (input.credits ?? []).filter((c) => c.handle.trim());

  const post = await prisma.post.create({
    data: {
      companyId: user.companyId,
      createdBy: user.id,
      sourceType,
      sourceText,
      sourceUrl: urls[0] ?? null,
      scrapedContent,
      credits: credits.length ? credits : undefined,
      status: POST_STATUS.PROCESSING_AI,
      photos: input.photo
        ? { create: [{ storageUrl: input.photo.storageUrl, orderIndex: 0 }] }
        : undefined,
    },
    include: { photos: true },
  });

  try {
    const content = await generatePostContent({
      text: sourceText,
      sourceUrl: urls[0],
      scrapedContent,
      hasPhoto: !!input.photo,
      credits: credits as Credit[],
    });

    await prisma.postVersion.create({
      data: {
        postId: post.id,
        versionNumber: 1,
        origin: "ai_generated",
        title: content.title,
        subtitle: content.subtitle,
        instagramCaption: content.instagramCaption,
        imageSuggestions: content.imageSuggestions.length
          ? content.imageSuggestions
          : undefined,
        aiProvider: content.meta?.provider,
        aiModel: content.meta?.model,
        // pre-selects the first photo, if any
        selectedPhotoId: post.photos[0]?.id ?? null,
        editedBy: user.id,
      },
    });

    await prisma.post.update({
      where: { id: post.id },
      data: { status: POST_STATUS.EDITING_ART },
    });
  } catch (err) {
    await prisma.post.update({
      where: { id: post.id },
      data: { status: POST_STATUS.FAILED },
    });
    throw new ApiError(
      502,
      `AI pipeline failed: ${(err as Error).message}`,
    );
  }

  return getPostDetail(post.id);
}

// ── 2) Salvar arte + render final (foto) ─────────────────────
export async function saveArtAndRender(
  user: CompanyUser,
  postId: string,
  input: SaveArtInput,
) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  if (!canEditPost(user, post)) throw forbidden("You cannot edit this post.");

  const [photo, template, version] = await Promise.all([
    prisma.postPhoto.findUnique({ where: { id: input.selectedPhotoId } }),
    prisma.artTemplate.findUnique({ where: { id: input.artTemplateId } }),
    latestVersion(postId),
  ]);
  if (!photo || photo.postId !== postId) throw badRequest("Invalid photo.");
  if (!template || template.companyId !== user.companyId) {
    throw badRequest("Invalid template.");
  }

  // Carousel photos 2..N — every one must belong to this post.
  const slideIds = input.carouselSlides.map((s) => s.photoId);
  const slidePhotos = slideIds.length
    ? await prisma.postPhoto.findMany({ where: { id: { in: slideIds }, postId } })
    : [];
  if (slidePhotos.length !== slideIds.length) throw badRequest("Invalid carousel photo.");
  const slideUrlById = new Map(slidePhotos.map((p) => [p.id, p.storageUrl]));

  const stamp = Date.now();
  const coverRender = renderAndStore(
    {
      canvasWidth: template.canvasWidth,
      canvasHeight: template.canvasHeight,
      overlayAssetUrl: template.overlayAssetUrl,
      photoUrl: photo.storageUrl,
      photoSlot: template.photoSlot,
      titleSlot: template.titleSlot,
      subtitleSlot: template.subtitleSlot ?? undefined,
      transform: input.photoTransform,
      title: input.title,
      subtitle: input.subtitle,
      titleOffset: input.titleOffset,
      subtitleOffset: input.subtitleOffset,
    },
    `art/${postId}/v${version.versionNumber}-${stamp}.png`,
  );
  // Same proportion as the cover (Instagram crops every item to the first one's).
  const slideRenders = input.carouselSlides.map((slide, i) =>
    renderSlideAndStore(
      {
        photoUrl: slideUrlById.get(slide.photoId)!,
        canvasWidth: template.canvasWidth,
        canvasHeight: template.canvasHeight,
        transform: slide.transform,
      },
      `art/${postId}/v${version.versionNumber}-${stamp}-s${i + 2}.jpg`,
    ),
  );
  const [renderedArtUrl, ...renderedSlideUrls] = await Promise.all([coverRender, ...slideRenders]);

  const updatedVersion = await prisma.postVersion.update({
    where: { id: version.id },
    data: {
      selectedPhotoId: photo.id,
      artTemplateId: template.id,
      photoTransform: input.photoTransform,
      title: input.title,
      subtitle: input.subtitle,
      titleOffset: input.titleOffset,
      subtitleOffset: input.subtitleOffset,
      renderedArtUrl,
      // Empty when it is not a carousel — saving a single photo turns it off.
      carouselSlides: input.carouselSlides.length ? input.carouselSlides : Prisma.DbNull,
      renderedSlideUrls,
      editedBy: user.id,
    },
  });

  await advanceAfterRender(post.companyId, postId, updatedVersion);
  return getPostDetail(postId);
}

// ── 2v) Save video + final render (animated text) ───────────
export async function saveVideoAndRender(
  user: CompanyUser,
  postId: string,
  input: SaveVideoInput,
) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  if (!canEditPost(user, post)) throw forbidden("You cannot edit this post.");

  const [video, version, company] = await Promise.all([
    prisma.postVideo.findUnique({ where: { id: input.selectedVideoId } }),
    latestVersion(postId),
    prisma.company.findUnique({ where: { id: post.companyId } }),
  ]);
  if (!video || video.postId !== postId) throw badRequest("Invalid video.");

  const renderedVideoUrl = await renderVideoAndStore(
    {
      videoUrl: video.storageUrl,
      title: input.title,
      logoUrl: company?.logoUrl,
      titleOffsetY: input.titleOffsetY,
      videoTemplate: input.videoTemplate,
      brandColors: { dark: company?.brandColorDark, light: company?.brandColorLight },
    },
    `video/${postId}/v${version.versionNumber}-${Date.now()}.mp4`,
  );

  const updatedVersion = await prisma.postVersion.update({
    where: { id: version.id },
    data: {
      selectedVideoId: video.id,
      title: input.title,
      // Same field the photo uses for the title offset — only the Y here.
      titleOffset: { offsetX: 0, offsetY: input.titleOffsetY ?? 0 },
      videoTemplate: input.videoTemplate,
      renderedVideoUrl,
      editedBy: user.id,
    },
  });

  await advanceAfterRender(post.companyId, postId, updatedVersion);
  return getPostDetail(postId);
}

/**
 * After the final art/video is ready: with the review flow turned off in the
 * admin, it publishes straight away — nobody needs to approve. With it on
 * (default), it moves on to "in review". Shared by photo and video.
 */
async function advanceAfterRender(
  companyId: string,
  postId: string,
  version: PostVersion,
): Promise<void> {
  const settings = await getAppSettings(companyId);
  if (settings.reviewRequired) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: POST_STATUS.IN_REVIEW },
    });
  } else {
    await publishVersion(postId, version);
  }
}

// ── 2b) Attach an extra photo to an already-created post ─────
/**
 * The reporter may decide on the photo AFTER the text is generated: found a
 * better option, downloaded one from Google Images or from a free stock
 * library based on an AI suggestion. This only adds a photo to the post's
 * list — it never replaces or removes the one that was already there; which
 * one to use is still a manual choice, in the art editor.
 */
export async function addPhotoToPost(
  user: CompanyUser,
  postId: string,
  input: AddPhotoInput,
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { _count: { select: { photos: true } } },
  });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  if (!canEditPost(user, post)) throw forbidden("You cannot edit this post.");

  const photo = await prisma.postPhoto.create({
    data: {
      postId,
      storageUrl: input.storageUrl,
      orderIndex: post._count.photos,
    },
  });

  return { photo, post: await getPostDetail(postId) };
}

// ── 2c) Attach an extra video to an already-created post ─────
export async function addVideoToPost(
  user: CompanyUser,
  postId: string,
  input: AddVideoInput,
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { _count: { select: { videos: true } } },
  });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  if (!canEditPost(user, post)) throw forbidden("You cannot edit this post.");

  // Middle frame already in the final framing (9:16): it is the background of
  // the preview in the editor, and the probe says how much the 9:16 crop will
  // eat from the sides. If it fails, the video is added anyway — the editor
  // just has no preview.
  let previewFrameUrl: string | null = null;
  let probe: { durationSec: number; width: number; height: number } | null = null;
  // The failure reason goes back in the response (not only in the server
  // log): without it the editor only shows "no preview" and the real cause
  // stays stuck in the Vercel dashboard.
  let previewError: string | null = null;
  try {
    const frame = await extractAndStoreMiddleFrame(
      input.storageUrl,
      `video/${postId}/frames/${Date.now()}.jpg`,
    );
    previewFrameUrl = frame.url;
    probe = frame.probe;
  } catch (err) {
    previewError = err instanceof Error ? err.message : String(err);
    console.error("[JornAI] Failed to extract the preview frame of the video:", err);
  }

  const video = await prisma.postVideo.create({
    data: {
      postId,
      storageUrl: input.storageUrl,
      durationMs: probe ? Math.round(probe.durationSec * 1000) : input.durationMs,
      previewFrameUrl,
      width: probe?.width,
      height: probe?.height,
      orderIndex: post._count.videos,
    },
  });

  return { video, previewError, post: await getPostDetail(postId) };
}

// ── 3) Regenerate (new AI cycle, new version) ────────────────
export async function regeneratePost(
  user: CompanyUser,
  postId: string,
  input: RegenerateInput,
) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  // staff can redo their own; manager/admin any; a peer (peer reviewer) can
  // also ask for a rewrite on another staff member's story.
  if (!canEditPost(user, post) && !canReviewPost(user, post)) {
    throw forbidden("You are not allowed to redo this.");
  }

  // A test post ("teste") has no source at all — the AI would invent everything.
  if (!post.sourceText && !post.scrapedContent && !post.sourceUrl) {
    throw badRequest("This story has no source text for the AI to rewrite. Edit the text by hand.");
  }

  const prev = await latestVersion(postId);

  const photoCount = await prisma.postPhoto.count({ where: { postId } });
  let content;
  try {
    content = await generatePostContent({
      text: post.sourceText,
      sourceUrl: post.sourceUrl,
      scrapedContent: post.scrapedContent,
      hasPhoto: photoCount > 0,
      credits: (post.credits as Credit[] | null) ?? undefined,
      guidance: input.guidance,
    });
  } catch (err) {
    // Nothing was changed yet — the post stays exactly as it was.
    throw new ApiError(
      502,
      `AI rewrite failed: ${(err as Error).message}`,
    );
  }

  const version = await prisma.postVersion.create({
    data: {
      postId,
      versionNumber: await nextVersionNumber(postId),
      origin: "ai_regenerated",
      title: content.title,
      subtitle: content.subtitle,
      instagramCaption: content.instagramCaption,
      imageSuggestions: content.imageSuggestions.length
        ? content.imageSuggestions
        : undefined,
      // carries over the art/video choices of the previous version (it must be re-rendered)
      selectedPhotoId: prev.selectedPhotoId,
      artTemplateId: prev.artTemplateId,
      photoTransform: prev.photoTransform ?? undefined,
      titleOffset: prev.titleOffset ?? undefined,
      subtitleOffset: prev.subtitleOffset ?? undefined,
      carouselSlides: prev.carouselSlides ?? undefined,
      selectedVideoId: prev.selectedVideoId,
      videoTemplate: prev.videoTemplate,
      editedBy: user.id,
    },
  });

  // If it came from a review (manager/admin or a peer reviewing), records the decision.
  if (canReviewPost(user, post)) {
    await prisma.reviewDecision.create({
      data: {
        postVersionId: prev.id,
        reviewerId: user.id,
        decision: "regenerate",
        reason: input.guidance ?? null,
      },
    });
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: POST_STATUS.EDITING_ART },
  });

  return { post: await getPostDetail(postId), versionId: version.id };
}

// ── 4) Manual text edit (new version) ────────────────────────
export async function editVersionManually(
  user: CompanyUser,
  postId: string,
  versionId: string,
  input: EditVersionInput,
) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  if (!canEditPost(user, post)) throw forbidden("You are not allowed to edit this.");

  const source = await prisma.postVersion.findUnique({
    where: { id: versionId },
  });
  if (!source || source.postId !== postId) throw notFound("Version not found.");

  // Title and subtitle appear on the art — if they changed, it must be re-rendered.
  const artChanged =
    (input.title !== undefined && input.title !== source.title) ||
    (input.subtitle !== undefined && input.subtitle !== source.subtitle);

  // new manual_edit version (never overwrites)
  const version = await prisma.postVersion.create({
    data: {
      postId,
      versionNumber: await nextVersionNumber(postId),
      origin: "manual_edit",
      title: input.title ?? source.title,
      subtitle: input.subtitle ?? source.subtitle,
      instagramCaption: input.instagramCaption ?? source.instagramCaption,
      imageSuggestions: source.imageSuggestions ?? undefined,
      selectedPhotoId: source.selectedPhotoId,
      artTemplateId: source.artTemplateId,
      photoTransform: source.photoTransform ?? undefined,
      titleOffset: source.titleOffset ?? undefined,
      subtitleOffset: source.subtitleOffset ?? undefined,
      renderedArtUrl: source.renderedArtUrl,
      // Carousel photos carry no text: the rendered ones stay valid.
      carouselSlides: source.carouselSlides ?? undefined,
      renderedSlideUrls: source.renderedSlideUrls,
      selectedVideoId: source.selectedVideoId,
      videoTemplate: source.videoTemplate,
      renderedVideoUrl: source.renderedVideoUrl,
      editedBy: user.id,
    },
  });

  let finalRenderedArtUrl = version.renderedArtUrl;
  if (artChanged && version.artTemplateId && version.selectedPhotoId) {
    const [photo, template] = await Promise.all([
      prisma.postPhoto.findUnique({ where: { id: version.selectedPhotoId } }),
      prisma.artTemplate.findUnique({ where: { id: version.artTemplateId } }),
    ]);
    if (photo && template) {
      const url = await renderAndStore(
        {
          canvasWidth: template.canvasWidth,
          canvasHeight: template.canvasHeight,
          overlayAssetUrl: template.overlayAssetUrl,
          photoUrl: photo.storageUrl,
          photoSlot: template.photoSlot,
          titleSlot: template.titleSlot,
          subtitleSlot: template.subtitleSlot ?? undefined,
          transform: version.photoTransform ?? {},
          title: version.title ?? "",
          subtitle: version.subtitle ?? "",
          titleOffset: version.titleOffset ?? undefined,
          subtitleOffset: version.subtitleOffset ?? undefined,
        },
        `art/${postId}/v${version.versionNumber}-${Date.now()}.png`,
      );
      await prisma.postVersion.update({
        where: { id: version.id },
        data: { renderedArtUrl: url },
      });
      finalRenderedArtUrl = url;
    }
  }

  // Video post: the title changed -> the animated card must be re-recorded.
  let finalRenderedVideoUrl = version.renderedVideoUrl;
  if (artChanged && version.selectedVideoId) {
    const [video, company] = await Promise.all([
      prisma.postVideo.findUnique({ where: { id: version.selectedVideoId } }),
      prisma.company.findUnique({ where: { id: post.companyId } }),
    ]);
    if (video) {
      const offset = version.titleOffset as { offsetY?: number } | null;
      const url = await renderVideoAndStore(
        {
          videoUrl: video.storageUrl,
          title: version.title ?? "",
          logoUrl: company?.logoUrl,
          titleOffsetY: offset?.offsetY ?? 0,
          videoTemplate: version.videoTemplate as "classic" | "light" | "bold",
          brandColors: { dark: company?.brandColorDark, light: company?.brandColorLight },
        },
        `video/${postId}/v${version.versionNumber}-${Date.now()}.mp4`,
      );
      await prisma.postVersion.update({
        where: { id: version.id },
        data: { renderedVideoUrl: url },
      });
      finalRenderedVideoUrl = url;
    }
  }

  if (can.review(user)) {
    await prisma.reviewDecision.create({
      data: {
        postVersionId: source.id,
        reviewerId: user.id,
        decision: "manual_edit",
      },
    });
  }

  // Same rule as saving the art/video: with review turned off and the media
  // already ready, it publishes straight away instead of waiting "in review".
  const settings = await getAppSettings(user.companyId);
  const mediaReady = !!finalRenderedArtUrl || !!finalRenderedVideoUrl;
  if (settings.reviewRequired || !mediaReady) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: POST_STATUS.IN_REVIEW },
    });
  } else {
    await publishVersion(postId, {
      ...version,
      renderedArtUrl: finalRenderedArtUrl,
      renderedVideoUrl: finalRenderedVideoUrl,
    });
  }

  return { post: await getPostDetail(postId), versionId: version.id };
}

/**
 * Actually publishes to Instagram (photo or video) and reflects the result on
 * the post — used both by the manual approval (approveAndPublish) and by the
 * auto-publish when the review flow is turned off (see
 * AppSettings.reviewRequired).
 */
async function publishVersion(postId: string, version: PostVersion) {
  const isVideo = !!version.renderedVideoUrl;
  if (!version.renderedArtUrl && !version.renderedVideoUrl) {
    throw badRequest("The art/video has not been rendered for this version yet.");
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: POST_STATUS.PUBLISHING },
  });

  const publication = await prisma.publication.create({
    data: { postVersionId: version.id, status: PUBLICATION_STATUS.PENDING },
  });

  try {
    const caption = version.instagramCaption ?? version.title ?? "";
    const isCarousel = !isVideo && version.renderedSlideUrls.length > 0;
    const result = isVideo
      ? await publishVideoToInstagram(version.renderedVideoUrl!, caption)
      : isCarousel
        ? await publishCarouselToInstagram(
            [version.renderedArtUrl!, ...version.renderedSlideUrls],
            caption,
          )
        : await publishToInstagram(version.renderedArtUrl!, caption);
    await prisma.publication.update({
      where: { id: publication.id },
      data: {
        status: PUBLICATION_STATUS.PUBLISHED,
        instagramMediaId: result.mediaId,
        instagramPostUrl: result.permalink ?? null,
        publishedAt: new Date(),
      },
    });
    await prisma.post.update({
      where: { id: postId },
      data: { status: POST_STATUS.PUBLISHED },
    });
  } catch (err) {
    await prisma.publication.update({
      where: { id: publication.id },
      data: {
        status: PUBLICATION_STATUS.FAILED,
        errorMessage: (err as Error).message,
      },
    });
    await prisma.post.update({
      where: { id: postId },
      data: { status: POST_STATUS.FAILED },
    });
    throw new ApiError(502, `Failed to publish: ${(err as Error).message}`);
  }
}

// ── 5) Approve → publish to Instagram ────────────────────────
/**
 * Manager/admin approve with their own authority: 1 click publishes right
 * away. Staff cannot approve their own story — only a peer's (peer review) —
 * and alone it does not publish: the vote is recorded and only when
 * PEER_APPROVALS_NEEDED distinct peers have approved this version does the
 * publication actually fire.
 */
export async function approveAndPublish(
  user: CompanyUser,
  postId: string,
  versionId: string,
) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  if (!canReviewPost(user, post)) throw forbidden("You cannot review this post.");

  const version = await prisma.postVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.postId !== postId) throw notFound("Version not found.");
  if (!version.renderedArtUrl && !version.renderedVideoUrl) {
    throw badRequest("The art/video has not been rendered for this version yet.");
  }

  const isDirect = can.publish(user);

  if (!isDirect) {
    const already = await prisma.reviewDecision.findFirst({
      where: { postVersionId: versionId, reviewerId: user.id, decision: "approved" },
    });
    if (already) throw conflict("You already approved this version.");

    await prisma.reviewDecision.create({
      data: { postVersionId: versionId, reviewerId: user.id, decision: "approved" },
    });

    const approvedCount = await prisma.reviewDecision.count({
      where: { postVersionId: versionId, decision: "approved" },
    });
    // Peers still missing — the vote was recorded, but it does not publish yet.
    if (approvedCount < PEER_APPROVALS_NEEDED) return getPostDetail(postId);
  } else {
    await prisma.reviewDecision.create({
      data: { postVersionId: versionId, reviewerId: user.id, decision: "approved" },
    });
  }

  await publishVersion(postId, version);
  return getPostDetail(postId);
}

// ── 6) Recusar ───────────────────────────────────────────────
export async function rejectPost(
  user: CompanyUser,
  postId: string,
  versionId: string,
  reason: string,
) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  // A rejection is always immediate (from a manager/admin or a peer reviewer)
  // — the goal is to make it easy to block something bad, not also to demand 2 votes for it.
  if (!canReviewPost(user, post)) throw forbidden("You cannot reject this post.");

  const version = await prisma.postVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.postId !== postId) throw notFound("Version not found.");

  await prisma.reviewDecision.create({
    data: {
      postVersionId: versionId,
      reviewerId: user.id,
      decision: "rejected",
      reason,
    },
  });
  await prisma.post.update({
    where: { id: postId },
    data: { status: POST_STATUS.REJECTED },
  });

  return getPostDetail(postId);
}

// ── Leitura ──────────────────────────────────────────────────
export function getPostDetail(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
      photos: { orderBy: { orderIndex: "asc" } },
      videos: { orderBy: { orderIndex: "asc" } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          decisions: {
            include: { reviewer: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
          publications: { orderBy: { createdAt: "desc" } },
          artTemplate: true,
          selectedPhoto: true,
          selectedVideo: true,
        },
      },
    },
  });
}

/**
 * Does not trigger the retention cleanup in here: whoever calls `listPosts`
 * usually also calls `listAuditLogs` in parallel (`Promise.all`), and if the
 * cleanup ran as a hidden side effect here, the log read could run BEFORE the
 * row was inserted (the post vanishes from the feed but the log has not
 * shown up yet). So whoever builds the page triggers
 * `maybeCleanupExpiredPosts()` explicitly before reading both.
 */
export function listPosts(companyId: string, opts: { status?: string; mineFor?: string } = {}) {
  return prisma.post.findMany({
    where: {
      companyId,
      status: opts.status,
      createdBy: opts.mineFor,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          subtitle: true,
          renderedArtUrl: true,
          renderedVideoUrl: true,
          renderedSlideUrls: true,
          versionNumber: true,
          // Only the static frame — the feed card never needs to download the
          // whole rendered (heavy) video just to show a thumbnail.
          selectedVideo: { select: { previewFrameUrl: true } },
          decisions: {
            where: { decision: "approved" },
            select: { reviewerId: true },
          },
        },
      },
    },
  });
}

/**
 * Deletes a post right now, by the user's hand — regardless of status or age
 * (unlike the automatic cleanup, which only takes expired posts). Same rule
 * as canEditPost: admin/manager delete any post, staff only the ones they
 * created themselves. Same guarantee as the automatic cleanup: storage
 * (photos + art) goes away together with the database rows, and a minimal
 * record is left in post_audit_log. It touches nothing already published on
 * Instagram, only our side.
 */
export async function deletePostNow(user: CompanyUser, id: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { ...PURGE_SELECT, companyId: true, createdBy: true },
  });
  if (!post) throw notFound("Post not found.");
  assertSameCompany(post.companyId, user.companyId);
  if (!canEditPost(user, post)) {
    throw forbidden("You can only delete stories you created yourself.");
  }
  await purgePostsWithMedia([post]);
}

/**
 * Trail of what was deleted by the automatic cleanup — only the essentials
 * (title, status, author, dates) to answer "who posted what and when" in a
 * future audit, without keeping photos/versions/decisions.
 */
export function listAuditLogs(companyId: string, limit = 50) {
  return prisma.postAuditLog.findMany({
    where: { companyId },
    orderBy: { purgedAt: "desc" },
    take: limit,
  });
}

/**
 * The story text is exactly the word "teste" (or "test") — nothing else, no
 * link, no document. Strict on purpose: "teste de som na praça" is a real
 * story and goes to the AI as usual; only the bare word skips it.
 */
function isTestSubmission(input: CreatePostInput): boolean {
  if (input.url || input.document) return false;
  const word = (input.text ?? "").trim().toLowerCase().replace(/[.!?…]+$/, "");
  return word === "teste" || word === "test";
}

/**
 * Post filled with neutral placeholder text, without calling the AI — for
 * trying the flow (art, carousel, review) without spending tokens and without
 * the model inventing a story out of a single word. No AI badge (aiProvider
 * stays null) and no image suggestions.
 */
async function createTestPost(user: CompanyUser, input: CreatePostInput) {
  const content = testPostContent[getContentLanguage()];
  const credits = (input.credits ?? []).filter((c) => c.handle.trim());
  const post = await prisma.post.create({
    data: {
      companyId: user.companyId,
      createdBy: user.id,
      sourceType: "text",
      sourceText: null,
      credits: credits.length ? credits : undefined,
      status: POST_STATUS.EDITING_ART,
      photos: input.photo
        ? { create: [{ storageUrl: input.photo.storageUrl, orderIndex: 0 }] }
        : undefined,
    },
    include: { photos: true },
  });
  await prisma.postVersion.create({
    data: {
      postId: post.id,
      versionNumber: 1,
      origin: "manual_edit",
      title: content.title,
      subtitle: content.subtitle,
      instagramCaption: content.instagramCaption,
      selectedPhotoId: post.photos[0]?.id ?? null,
      editedBy: user.id,
    },
  });
  return getPostDetail(post.id);
}

/** How many links of a single submission are read (each becomes up to ~8k chars in the prompt). */
const MAX_LINKS = 4;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

function extractUrls(text: string): string[] {
  return (text.match(URL_RE) ?? []).map((u) => u.replace(/[).,;!?]+$/, ""));
}

/** Text without the URLs; leftover connector ("link1 and link2" → "and") counts as empty. */
function stripUrls(text: string): string {
  const rest = text.replace(URL_RE, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return (rest.match(/[\p{L}\p{N}]/gu) ?? []).length >= 10 ? rest : "";
}

function labelKind(kind: "structured" | "generic"): string {
  return kind === "structured" ? "structured document" : "article";
}

function logCompaction(source: string, r: CompactResult) {
  const savedPct =
    r.originalChars > 0
      ? Math.round((1 - r.compactChars / r.originalChars) * 100)
      : 0;
  console.log(
    `[JornAI] compaction (${source}): ${r.kind} · ${r.originalChars} → ${r.compactChars} chars` +
      (savedPct > 0 ? ` (-${savedPct}%)` : "") +
      (r.redactedCount > 0 ? ` · ${r.redactedCount} sensitive item(s) redacted` : "") +
      (r.removedDuplicateLines > 0 ? ` · ${r.removedDuplicateLines} repeated line(s) removed` : ""),
  );
}
