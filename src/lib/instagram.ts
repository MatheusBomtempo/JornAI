import "server-only";
import { env } from "./env";

/**
 * Instagram Graph API (Meta) client — publishing in 2 steps:
 *   1. POST /{ig-user-id}/media        (image_url + caption) -> creation_id
 *   2. POST /{ig-user-id}/media_publish (creation_id)        -> published media id
 *
 * Requirements (SPEC.md): Instagram Business/Creator account linked to a
 * Facebook Page, an app at developers.facebook.com, the account as an
 * Instagram Tester. Since it only publishes to its own account, the app can
 * run in development mode. Permission: instagram_business_content_publish.
 */

export interface PublishResult {
  creationId: string;
  mediaId: string;
  permalink?: string;
}

function baseUrl(): string {
  return `https://graph.instagram.com/${env.instagram.graphVersion}`;
}

function assertConfigured(): { userId: string; token: string } {
  const userId = env.instagram.userId;
  const token = env.instagram.accessToken;
  if (!userId || !token) {
    throw new Error(
      "Instagram is not configured: set IG_USER_ID and IG_ACCESS_TOKEN.",
    );
  }
  return { userId, token };
}

/** Step 1: creates the media container. */
export async function createMediaContainer(
  imageUrl: string,
  caption: string,
): Promise<string> {
  const { userId, token } = assertConfigured();
  const res = await fetch(`${baseUrl()}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(igError("create the media container", data));
  }
  return data.id as string;
}

/**
 * Step 2: publishes the container. Meta sometimes has not finished processing
 * the container when the publish arrives (PHOTOS included) and answers "Media
 * ID is not available" (code 9007) — it is transient, so it retries a few
 * times before giving up.
 */
export async function publishMediaContainer(
  creationId: string,
): Promise<string> {
  const { userId, token } = assertConfigured();
  const maxAttempts = 6;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl()}/${userId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    });
    const data = await res.json();
    if (res.ok && data.id) return data.id as string;
    if (attempt < maxAttempts - 1 && isMediaNotReady(data)) {
      await sleep(2000 + attempt * 1000);
      continue;
    }
    throw new Error(igError("publish the media", data));
  }
}

function isMediaNotReady(data: unknown): boolean {
  const err = (data as { error?: { code?: number; message?: string } })?.error;
  return err?.code === 9007 || /not available|not ready/i.test(err?.message ?? "");
}

/** Busca o permalink do post publicado (opcional, best-effort). */
export async function fetchPermalink(mediaId: string): Promise<string | undefined> {
  try {
    const { token } = assertConfigured();
    const res = await fetch(
      `${baseUrl()}/${mediaId}?fields=permalink&access_token=${token}`,
    );
    const data = await res.json();
    return typeof data.permalink === "string" ? data.permalink : undefined;
  } catch {
    return undefined;
  }
}

/** Full publishing flow (container + publish + permalink). */
export async function publishToInstagram(
  imageUrl: string,
  caption: string,
): Promise<PublishResult> {
  const { token } = assertConfigured();
  const creationId = await createMediaContainer(imageUrl, caption);
  // A photo is usually ready in 1-2s, but not instantly: publishing before
  // that gives "Media ID is not available".
  await waitForContainerReady(creationId, token, "image");
  const mediaId = await publishMediaContainer(creationId);
  const permalink = await fetchPermalink(mediaId);
  return { creationId, mediaId, permalink };
}

// ── Carousel ─────────────────────────────────────────────────
/**
 * Carousel publishing (Graph API): one container per image flagged
 * `is_carousel_item` (no caption), then a parent CAROUSEL container listing
 * the children (the caption goes here), and finally the usual publish. The
 * first URL is the cover — Instagram keeps the order given in `children`.
 */
async function createCarouselItemContainer(imageUrl: string): Promise<string> {
  const { userId, token } = assertConfigured();
  const res = await fetch(`${baseUrl()}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token: token }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(igError("create a carousel item", data));
  }
  return data.id as string;
}

export async function publishCarouselToInstagram(
  imageUrls: string[],
  caption: string,
): Promise<PublishResult> {
  const { userId, token } = assertConfigured();
  if (imageUrls.length < 2) throw new Error("A carousel needs at least 2 images.");

  // Sequential on purpose: keeps the order obvious in the logs and stays far
  // from Meta's rate limit; 10 photos are a few seconds anyway.
  const children: string[] = [];
  for (const url of imageUrls) {
    const id = await createCarouselItemContainer(url);
    await waitForContainerReady(id, token, "image");
    children.push(id);
  }

  const res = await fetch(`${baseUrl()}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(igError("create the carousel container", data));
  }
  const creationId = data.id as string;
  await waitForContainerReady(creationId, token, "image");
  const mediaId = await publishMediaContainer(creationId);
  const permalink = await fetchPermalink(mediaId);
  return { creationId, mediaId, permalink };
}

// ── Video (Reels) ────────────────────────────────────────────
/**
 * Video publishing is asynchronous on Meta's side: it creates the container
 * (media_type=REELS + video_url), waits for processing (status_code goes from
 * IN_PROGRESS to FINISHED — it can take tens of seconds to a few minutes
 * depending on the size), and only then publishes. Unlike a photo, which is
 * ready right away.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Step 1 (video): creates the media container as Reels. */
export async function createVideoMediaContainer(
  videoUrl: string,
  caption: string,
): Promise<string> {
  const { userId, token } = assertConfigured();
  const res = await fetch(`${baseUrl()}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(igError("create the video container", data));
  }
  return data.id as string;
}

/** Waits for Meta to finish downloading/processing the container before publishing. */
async function waitForContainerReady(
  creationId: string,
  token: string,
  kind: "image" | "video",
): Promise<void> {
  const isVideo = kind === "video";
  const what = isVideo ? "the video" : "the image";
  const maxAttempts = isVideo ? 40 : 15;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `${baseUrl()}/${creationId}?fields=status_code&access_token=${token}`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(igError(`check the status of ${what}`, data));
    // No status_code in the response (some accounts/versions do not return it
    // for photos): move on to the publish, which has its own retry.
    if (data.status_code === "FINISHED" || data.status_code === undefined) return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(
        `Instagram could not process ${what} (status: ${data.status_code}).`,
      );
    }
    await sleep(isVideo ? Math.min(3000 + attempt * 500, 8000) : 1000);
  }
  throw new Error(`Timed out waiting for Instagram to process ${what}.`);
}

/** Full video publishing flow (container + wait + publish + permalink). */
export async function publishVideoToInstagram(
  videoUrl: string,
  caption: string,
): Promise<PublishResult> {
  const { token } = assertConfigured();
  const creationId = await createVideoMediaContainer(videoUrl, caption);
  await waitForContainerReady(creationId, token, "video");
  const mediaId = await publishMediaContainer(creationId);
  const permalink = await fetchPermalink(mediaId);
  return { creationId, mediaId, permalink };
}

// ── Story ────────────────────────────────────────────────────
/**
 * Story publishing: same container + publish flow, with media_type=STORIES.
 * Stories take no caption. The 4:5/1:1 art is not 9:16 — Instagram fits it on
 * a background by itself, so the feed art goes as is.
 */
export async function publishStoryToInstagram(
  media: { imageUrl: string } | { videoUrl: string },
): Promise<PublishResult> {
  const { userId, token } = assertConfigured();
  const isVideo = "videoUrl" in media;
  const res = await fetch(`${baseUrl()}/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "STORIES",
      ...(isVideo ? { video_url: media.videoUrl } : { image_url: media.imageUrl }),
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(igError("create the story container", data));
  }
  const creationId = data.id as string;
  await waitForContainerReady(creationId, token, isVideo ? "video" : "image");
  const mediaId = await publishMediaContainer(creationId);
  const permalink = await fetchPermalink(mediaId);
  return { creationId, mediaId, permalink };
}

function igError(action: string, data: unknown): string {
  const err = (data as { error?: { message?: string } })?.error;
  return `Error trying to ${action} on Instagram: ${err?.message ?? JSON.stringify(data)}`;
}
