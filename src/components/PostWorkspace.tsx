"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, uploadWithProgress, type UploadProgress } from "@/lib/api-client";
import { ArtEditor, type EditorTemplate, type EditorPhoto } from "./ArtEditor";
import { VideoEditor, type EditorVideo } from "./VideoEditor";
import { InstagramPreview, CarouselTrack } from "./InstagramPreview";
import { CarouselManager } from "./CarouselManager";
import { PhotoEditButton } from "./PhotoEditModal";
import { StatusBadge } from "./StatusBadge";
import { Stepper } from "./Stepper";
import { BusyLabel, useElapsedSeconds } from "./Spinner";
import { useLocale } from "./LocaleProvider";
import { useActionOverlay, type RunContext } from "./ActionOverlay";
import { DEFAULT_SLIDE_TRANSFORM, type CarouselSlide } from "@/lib/carousel";
import {
  POST_STATUS,
  PEER_APPROVALS_NEEDED,
  CAROUSEL_MAX,
  formatCredit,
  type Credit,
  type UserRole,
} from "@/lib/domain";

const MAX_PHOTO_MB = 15;
const MAX_VIDEO_MB = 100;

function googleImagesUrl(query: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

function freePhotosUrl(query: string): string {
  return `https://www.pexels.com/search/${encodeURIComponent(query)}/`;
}

/**
 * Uploads the video to storage. Tries a direct PUT to the bucket first (signed
 * URL) — the body never goes through the function, so Vercel's payload ceiling
 * (much lower than the 100 MB the app accepts) does not come into play. With
 * local storage (dev) there is no signed URL: it falls back to the usual upload
 * via /api/upload. On both paths `onProgress` receives the bytes sent — it is
 * what feeds the modal's bar.
 */
async function uploadVideoFile(file: File, onProgress: UploadProgress): Promise<string> {
  const presign = await apiPost<{ uploadUrl: string | null; publicUrl?: string }>(
    "/api/upload/presign",
    { contentType: file.type },
  );

  if (presign.uploadUrl && presign.publicUrl) {
    try {
      await uploadWithProgress(
        presign.uploadUrl,
        { method: "PUT", body: file, headers: { "Content-Type": file.type } },
        onProgress,
      );
    } catch (err) {
      throw new Error(`Failed to upload the video to storage: ${(err as Error).message}`);
    }
    return presign.publicUrl;
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", "video");
  const up = await uploadWithProgress<{ url: string }>(
    "/api/upload",
    { method: "POST", body: fd },
    onProgress,
  );
  return up.url;
}

/** "12,4 MB" no idioma da interface. */
function formatMB(bytes: number, locale: string): string {
  return `${(bytes / 1048576).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}

interface Version {
  id: string;
  versionNumber: number;
  origin: string;
  title: string | null;
  subtitle: string | null;
  instagramCaption: string | null;
  imageSuggestions: string[];
  aiProvider: string | null;
  aiModel: string | null;
  renderedArtUrl: string | null;
  selectedPhotoId: string | null;
  artTemplateId: string | null;
  photoTransform: { offsetX: number; offsetY: number; scale: number } | null;
  titleOffset: { offsetX: number; offsetY: number } | null;
  subtitleOffset: { offsetX: number; offsetY: number } | null;
  selectedVideoId: string | null;
  videoTemplate: string | null;
  renderedVideoUrl: string | null;
  carouselSlides: CarouselSlide[];
  renderedSlideUrls: string[];
  createdAt: string;
  decisions: {
    id: string;
    decision: string;
    reason: string | null;
    reviewer: { id: string; name: string };
    createdAt: string;
  }[];
}

interface PostDetail {
  id: string;
  status: string;
  sourceType: string;
  createdBy: string;
  author: { name: string };
  credits: Credit[];
  photos: EditorPhoto[];
  videos: EditorVideo[];
  versions: Version[];
}

interface Props {
  user: { id: string; name: string; role: UserRole };
  post: PostDetail;
  templates: EditorTemplate[];
  company: {
    name: string | null;
    logoUrl: string | null;
    instagramHandle: string | null;
    brandColorDark: string | null;
    brandColorLight: string | null;
  };
}

const STEP_ORDER = ["text", "image", "review"] as const;
type Step = (typeof STEP_ORDER)[number];

type Panel = null | "rewrite" | "reject" | "text";

export function PostWorkspace({ user, post, templates, company }: Props) {
  const router = useRouter();
  const { dict, locale } = useLocale();
  const { run: runAction } = useActionOverlay();
  const dateLocale = locale === "pt" ? "pt-BR" : "en-US";
  const STEP_LABELS = [dict.postWorkspace.steps.text, dict.postWorkspace.steps.image, dict.postWorkspace.steps.review];
  const current = post.versions[0];

  // Who can edit text/photo (the author, or manager/admin) vs. who can review
  // ANOTHER person's story (a fellow reporter, or manager/admin). They are
  // different powers: reviewing does not grant the right to rewrite someone
  // else's post by hand, only to approve/reject/ask the AI to redo it.
  const isAuthor = post.createdBy === user.id;
  const isManagerOrAdmin = user.role === "manager" || user.role === "admin";
  const isPeerReviewer = user.role === "staff" && !isAuthor;
  const canEdit = isManagerOrAdmin || isAuthor;
  const canDecide = isManagerOrAdmin || isPeerReviewer;

  // The presence of a video decides the format of the whole step 2 (VideoEditor
  // instead of ArtEditor) — a video post uses no template/slots, only the
  // animated title card, always 9:16 (Reels standard).
  const isVideoPost = post.videos.length > 0;
  const mediaReady = !!current?.renderedArtUrl || !!current?.renderedVideoUrl;

  // Real proportion of this version's template, so the preview does not crop the 4:5.
  const currentTemplate = templates.find((t) => t.id === current?.artTemplateId);
  const previewRatio = isVideoPost
    ? 1080 / 1920
    : currentTemplate
      ? currentTemplate.canvasWidth / currentTemplate.canvasHeight
      : undefined;
  const isFinished =
    post.status === POST_STATUS.PUBLISHED || post.status === POST_STATUS.REJECTED;

  const naturalStep: Step =
    post.status === POST_STATUS.EDITING_ART ||
    post.status === POST_STATUS.PROCESSING_AI
      ? "image"
      : "review";
  const [stepOverride, setStepOverride] = useState<Step | null>(null);
  const step: Step = stepOverride ?? naturalStep;
  const stepIndex = STEP_ORDER.indexOf(step);
  const goToStep = (i: number) => setStepOverride(STEP_ORDER[i]);

  const [panel, setPanel] = useState<Panel>(null);
  const [guidance, setGuidance] = useState("");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState({
    title: current?.title ?? "",
    subtitle: current?.subtitle ?? "",
    instagramCaption: current?.instagramCaption ?? "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const elapsed = useElapsedSeconds(!!busy);

  // Photo decided AFTER generating the text (found a better one, downloaded from
  // Google or from a free library based on an AI suggestion). It never replaces
  // the photo already sent — it only joins the list for the reporter to choose.
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoDragging, setPhotoDragging] = useState(false);
  const [lastAddedPhotoId, setLastAddedPhotoId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // What is typed/chosen in the art editor (title, subtitle, format), unsaved. The editor
  // remounts when its photo changes — and the edited copy from the "Edit image" popup
  // is a new photo — so the draft is handed back as `initial` to not lose it.
  const draftRef = useRef<{ templateId: string; title: string; subtitle: string } | null>(null);
  const [carry, setCarry] = useState<{ templateId: string; title: string; subtitle: string } | null>(null);
  // A new version (AI rewrite, text edited by hand) brings its own title and
  // subtitle — an unsaved draft from before it must not override them.
  useEffect(() => {
    setCarry(null);
    draftRef.current = null;
  }, [current?.id]);
  const rememberDraft = useCallback(
    (draft: { templateId: string; title: string; subtitle: string }) => {
      draftRef.current = draft;
    },
    [],
  );

  // Wires the XHR bytes to the modal bar: "42% · 12.4 MB of 29.8 MB".
  const uploadProgress = useCallback(
    (progress: RunContext["progress"]): UploadProgress =>
      (sent, total) =>
        progress(
          sent / total,
          dict.postWorkspace.upload.progressOf
            .replace("{sent}", formatMB(sent, dateLocale))
            .replace("{total}", formatMB(total, dateLocale)),
        ),
    [dict, dateLocale],
  );

  // Upload + attach of one photo, no UI side effects — shared by the single
  // photo, the carousel (several in a row) and the photo replacement (blur).
  const uploadPhotoFile = useCallback(
    async (
      file: File,
      { log, progress }: Pick<RunContext, "log" | "progress">,
      label?: string,
    ): Promise<string> => {
      // Bar at 0% from the start: the "do not leave the app" warning depends on it.
      progress(0, label);
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadWithProgress<{ url: string }>(
        "/api/upload",
        { method: "POST", body: fd },
        label ? (sent, total) => progress(sent / total, label) : uploadProgress(progress),
      );
      progress(null);
      log(dict.postWorkspace.upload.photoOnServer);
      const { photo } = await apiPost<{ photo: { id: string } }>(
        `/api/posts/${post.id}/photos`,
        { storageUrl: up.url },
      );
      return photo.id;
    },
    [post.id, dict, uploadProgress],
  );

  /** Same checks as the single upload; returns the error message, or null. */
  const photoFileError = useCallback(
    (file: File): string | null => {
      if (!file.type.startsWith("image/")) return dict.postWorkspace.errors.invalidFileType;
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        return `${dict.postWorkspace.errors.fileTooLargePrefix} ${MAX_PHOTO_MB} ${dict.postWorkspace.errors.fileTooLargeSuffix}`;
      }
      return null;
    },
    [dict],
  );

  // ── Carousel ──
  // Lives here (not in the ArtEditor) so it survives router.refresh() and the
  // editor remounts. coverId = photo 1 (template + text); slides = photos 2..N.
  const [carousel, setCarousel] = useState<{ coverId: string; slides: CarouselSlide[] } | null>(
    () =>
      current?.selectedPhotoId && current.carouselSlides.length
        ? { coverId: current.selectedPhotoId, slides: current.carouselSlides }
        : null,
  );
  const [carouselError, setCarouselError] = useState<string | null>(null);
  const [carouselBusy, setCarouselBusy] = useState(false);
  const carouselInputRef = useRef<HTMLInputElement>(null);

  /** A newly attached photo: in a carousel it becomes the next slide, otherwise the photo in the editor. */
  const attachNewPhoto = useCallback(
    (id: string) => {
      if (!carousel) {
        setLastAddedPhotoId(id);
        return;
      }
      if (1 + carousel.slides.length >= CAROUSEL_MAX) {
        setCarouselError(dict.carousel.full.replace("{max}", String(CAROUSEL_MAX)));
        return;
      }
      setCarousel((prev) =>
        prev ? { ...prev, slides: [...prev.slides, { photoId: id, transform: DEFAULT_SLIDE_TRANSFORM }] } : prev,
      );
    },
    [carousel, dict],
  );

  const addPhoto = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      const invalid = photoFileError(file);
      if (invalid) {
        setPhotoError(invalid);
        return;
      }
      setPhotoError(null);
      setPhotoBusy(true);
      // Upload goes to the modal with a progress bar — on a server abroad even a
      // photo takes a few seconds, and the drop zone's "Uploading…" goes out of
      // view on a phone.
      const result = await runAction({
        title: dict.postWorkspace.busy.uploadingPhoto,
        success: dict.postWorkspace.done.photoAdded,
        fn: (ctx) => uploadPhotoFile(file, ctx),
      });
      setPhotoBusy(false);
      if (!result.ok) return;
      attachNewPhoto(result.value);
      router.refresh();
    },
    [router, dict, runAction, uploadPhotoFile, photoFileError, attachNewPhoto],
  );

  /**
   * Several photos at once for the carousel. Photos only: anything else
   * (video included) is left out with a warning. The order is the one the
   * files arrive in — the first becomes the cover when there is none yet, and
   * the manager makes the reporter double-check it ("Make cover").
   */
  const addCarouselPhotos = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      const files = Array.from(fileList ?? []);
      if (!files.length) return;
      if (post.videos.length > 0) {
        setCarouselError(dict.carousel.videoBlocked);
        return;
      }
      const messages: string[] = [];
      const notPhotos = files.filter((f) => !f.type.startsWith("image/"));
      if (notPhotos.length) {
        messages.push(dict.carousel.videosIgnored.replace("{count}", String(notPhotos.length)));
      }
      let photos = files.filter((f) => f.type.startsWith("image/"));
      for (const f of photos) {
        const invalid = photoFileError(f);
        if (invalid) messages.push(`${f.name}: ${invalid}`);
      }
      photos = photos.filter((f) => !photoFileError(f));

      const existingCover =
        carousel?.coverId ?? lastAddedPhotoId ?? current?.selectedPhotoId ?? post.photos[0]?.id;
      const used = carousel ? 1 + carousel.slides.length : existingCover ? 1 : 0;
      const room = CAROUSEL_MAX - used;
      if (room <= 0) {
        messages.push(dict.carousel.full.replace("{max}", String(CAROUSEL_MAX)));
        photos = [];
      } else if (photos.length > room) {
        messages.push(
          dict.carousel.overLimit
            .replace("{max}", String(CAROUSEL_MAX))
            .replace("{count}", String(photos.length - room)),
        );
        photos = photos.slice(0, room);
      }
      setCarouselError(messages.length ? messages.join(" ") : null);
      if (!photos.length) return;

      setCarouselBusy(true);
      // Ids collected outside the action: if photo 4 of 6 fails, the 3 already
      // attached still join the carousel instead of being lost.
      const ids: string[] = [];
      await runAction({
        title: dict.carousel.uploading,
        success: dict.carousel.uploaded,
        slowAfterSeconds: 30,
        fn: async (ctx) => {
          for (let i = 0; i < photos.length; i++) {
            const label = dict.carousel.uploadingOne
              .replace("{index}", String(i + 1))
              .replace("{total}", String(photos.length));
            ctx.log(label);
            ids.push(await uploadPhotoFile(photos[i], ctx, label));
          }
        },
      });
      setCarouselBusy(false);
      if (!ids.length) return;

      const toSlides = (list: string[]) =>
        list.map((photoId) => ({ photoId, transform: DEFAULT_SLIDE_TRANSFORM }));
      setCarousel((prev) => {
        if (prev) return { ...prev, slides: [...prev.slides, ...toSlides(ids)] };
        if (existingCover) return { coverId: existingCover, slides: toSlides(ids) };
        return { coverId: ids[0], slides: toSlides(ids.slice(1)) };
      });
      router.refresh();
    },
    [
      post.videos.length, post.photos, carousel, lastAddedPhotoId, current?.selectedPhotoId,
      dict, runAction, uploadPhotoFile, photoFileError, router,
    ],
  );

  const openCarouselPicker = () => {
    if (post.videos.length > 0) {
      setCarouselError(dict.carousel.videoBlocked);
      return;
    }
    carouselInputRef.current?.click();
  };

  /** Swaps slide `index` with the cover — the old cover takes its place, centered. */
  const makeCover = (index: number) =>
    setCarousel((prev) => {
      if (!prev || !prev.slides[index]) return prev;
      const slides = [...prev.slides];
      const nextCover = slides[index].photoId;
      slides[index] = { photoId: prev.coverId, transform: DEFAULT_SLIDE_TRANSFORM };
      return { coverId: nextCover, slides };
    });

  const exitCarousel = () => {
    if (carousel && carousel.coverId !== current?.selectedPhotoId) setLastAddedPhotoId(carousel.coverId);
    setCarousel(null);
    setCarouselError(null);
  };

  /**
   * Puts an edited copy (e.g. blurred faces) in place of a carousel photo:
   * uploads it as a new photo — the original stays in the post untouched — and
   * swaps the id in the same position, with the framing reset (the copy already
   * comes cropped to the carousel's proportion).
   */
  const replaceCarouselPhoto = useCallback(
    async (photoId: string, file: File) => {
      const result = await runAction({
        title: dict.postWorkspace.busy.uploadingPhoto,
        success: dict.postWorkspace.done.photoAdded,
        fn: (ctx) => uploadPhotoFile(file, ctx),
      });
      if (!result.ok) return;
      const newId = result.value;
      setCarousel((prev) =>
        prev
          ? {
              coverId: prev.coverId === photoId ? newId : prev.coverId,
              // The edited copy is already cropped to the carousel's proportion, so it starts centered.
              slides: prev.slides.map((s) =>
                s.photoId === photoId ? { photoId: newId, transform: DEFAULT_SLIDE_TRANSFORM } : s,
              ),
            }
          : prev,
      );
      router.refresh();
    },
    [dict, runAction, uploadPhotoFile, router],
  );

  // Built-in Pexels search (see PhotoPickerModal) — string = query open in the
  // picker, null = closed. Only one picker at a time, so it lives at the
  // workspace level instead of duplicated inside each ImageSuggestions.
  const [photoPickerQuery, setPhotoPickerQuery] = useState<string | null>(null);

  // Same ending as addPhoto (attaches and reloads), but from a photo already
  // chosen in the picker instead of a File from the input. The download happens
  // on the server, so there is no bar — only the log and the counter. Returns
  // whether it worked so the picker can decide whether to close.
  const importPexelsPhoto = useCallback(
    async (downloadUrl: string): Promise<boolean> => {
      const result = await runAction({
        title: dict.postWorkspace.busy.importingPhoto,
        success: dict.postWorkspace.done.photoAdded,
        fn: async ({ log }) => {
          const up = await apiPost<{ url: string }>("/api/photo-search/import", { downloadUrl });
          log(dict.postWorkspace.upload.photoImported);
          const { photo } = await apiPost<{ photo: { id: string } }>(
            `/api/posts/${post.id}/photos`,
            { storageUrl: up.url },
          );
          return photo;
        },
      });
      if (!result.ok) return false;
      attachNewPhoto(result.value.id);
      router.refresh();
      return true;
    },
    [post.id, router, dict, runAction, attachNewPhoto],
  );

  // Same idea as addPhoto, for video — attaches, reloads and already leaves the
  // new video selected in the VideoEditor. Before, the editor stayed on the old
  // video: whoever used "Add or change the video" and saved rendered the wrong
  // video without noticing.
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoDragging, setVideoDragging] = useState(false);
  const [lastAddedVideoId, setLastAddedVideoId] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const addVideo = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        setVideoError(dict.postWorkspace.errors.invalidVideoType);
        return;
      }
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setVideoError(
          `${dict.postWorkspace.errors.videoTooLargePrefix} ${MAX_VIDEO_MB} ${dict.postWorkspace.errors.videoTooLargeSuffix}`,
        );
        return;
      }
      setVideoError(null);
      setVideoBusy(true);
      // Progress bar during the upload (the slow part with 100 MB to a server
      // abroad); afterwards only the log — the preview is generated on the server.
      const result = await runAction({
        title: dict.postWorkspace.busy.uploadingVideo,
        success: dict.postWorkspace.done.videoAdded,
        // Upload of up to 100 MB + preview on the server: 8 s (the default) is normal
        // here, not slowness — the progress bar already shows the progress.
        slowAfterSeconds: 60,
        fn: async ({ log, progress }) => {
          progress(0);
          const storageUrl = await uploadVideoFile(file, uploadProgress(progress));
          progress(null);
          log(dict.postWorkspace.upload.videoOnServer);
          return apiPost<{ video: { id: string }; previewError?: string | null }>(
            `/api/posts/${post.id}/videos`,
            { storageUrl },
          );
        },
      });
      setVideoBusy(false);
      if (!result.ok) return;
      setLastAddedVideoId(result.value.video.id);
      // The video is added even without a preview, but the reason shows on screen
      // instead of staying only in the server log.
      if (result.value.previewError) setVideoError(result.value.previewError);
      router.refresh();
    },
    [post.id, router, dict, runAction, uploadProgress],
  );

  // Loading/error/success of the decisions go to the modal (ActionOverlay); all
  // that is left here is locking the buttons and, if it worked, going back to the natural step.
  async function run(label: string, success: string, fn: () => Promise<unknown>) {
    setBusy(label);
    const result = await runAction({ title: label, success, fn });
    setBusy(null);
    if (!result.ok) return;
    setPanel(null);
    setStepOverride(null);
    router.refresh();
  }

  const approve = () =>
    run(
      isPeerReviewer ? dict.postWorkspace.busy.registeringApproval : dict.postWorkspace.busy.publishing,
      isPeerReviewer ? dict.postWorkspace.done.approvalRegistered : dict.postWorkspace.done.published,
      () => apiPost(`/api/posts/${post.id}/versions/${current.id}/approve`),
    );

  const reject = () =>
    run(dict.postWorkspace.busy.rejecting, dict.postWorkspace.done.rejected, () =>
      apiPost(`/api/posts/${post.id}/versions/${current.id}/reject`, { reason }),
    );

  const rewrite = () =>
    run(dict.postWorkspace.busy.rewriting, dict.postWorkspace.done.rewritten, () =>
      apiPost(`/api/posts/${post.id}/regenerate`, {
        guidance: guidance.trim() || undefined,
      }),
    );

  const saveText = () =>
    run(dict.postWorkspace.busy.savingText, dict.postWorkspace.done.textSaved, () =>
      apiPatch(`/api/posts/${post.id}/versions/${current.id}`, draft),
    );

  const hasPhotos = post.photos.length > 0;
  const hasVideos = post.videos.length > 0;
  const hasTemplates = templates.length > 0;
  // Photo the art editor frames: the carousel cover, a just-added photo, or the saved one.
  const coverPhotoId = carousel?.coverId ?? lastAddedPhotoId ?? current?.selectedPhotoId;

  const approvals = current?.decisions.filter((d) => d.decision === "approved") ?? [];
  const myApproval = approvals.find((d) => d.reviewer.id === user.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusBadge status={post.status} />
        <span className="text-xs text-muted">
          {dict.postWorkspace.header.byLabel} {post.author.name} · {dict.postWorkspace.header.versionLabel}{" "}
          {current?.versionNumber}
        </span>
      </div>

      {!isFinished && (
        <div className="space-y-2">
          <Stepper steps={STEP_LABELS} current={stepIndex} reachable={2} onStepClick={goToStep} />
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="btn-subtle btn-sm"
              disabled={stepIndex === 0}
              onClick={() => goToStep(stepIndex - 1)}
            >
              {dict.postWorkspace.back}
            </button>
            <button
              type="button"
              className="btn-subtle btn-sm"
              disabled={stepIndex === STEP_ORDER.length - 1}
              onClick={() => goToStep(stepIndex + 1)}
            >
              {dict.postWorkspace.forward}
            </button>
          </div>
        </div>
      )}

      {/* ───────────── PASSO 1: TEXTO ───────────── */}
      {step === "text" && (
        <section className="card space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{dict.postWorkspace.text.heading}</h2>
              {current?.aiProvider && (
                <span
                  className="badge bg-brand-500/10 text-brand-300"
                  title={
                    current.aiModel
                      ? `${dict.postWorkspace.text.modelPrefix} ${current.aiModel}`
                      : undefined
                  }
                >
                  ✨ {aiSourceLabel(current.aiProvider, dict.postWorkspace.aiSource)}
                </span>
              )}
            </div>
            {canEdit && !isFinished && panel !== "text" && (
              <button className="btn-ghost btn-sm" onClick={() => setPanel("text")}>
                {dict.postWorkspace.text.editButton}
              </button>
            )}
          </div>

          {panel === "text" ? (
            <div className="space-y-3">
              <Field label={dict.postWorkspace.text.titleLabel} value={draft.title} max={69}
                onChange={(v) => setDraft({ ...draft, title: v })} />
              <Field label={dict.postWorkspace.text.subtitleLabel} textarea max={149} value={draft.subtitle}
                onChange={(v) => setDraft({ ...draft, subtitle: v })} />
              <Field label={dict.postWorkspace.text.captionLabel} textarea rows={10}
                value={draft.instagramCaption}
                onChange={(v) => setDraft({ ...draft, instagramCaption: v })} />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={saveText} disabled={!!busy}>
                  {busy ? <BusyLabel label={busy} seconds={elapsed} /> : dict.postWorkspace.text.saveButton}
                </button>
                <button className="btn-subtle" onClick={() => setPanel(null)}>
                  {dict.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <dl className="space-y-3">
              <Read label={dict.postWorkspace.text.titleLabel} value={current?.title} art />
              <Read label={dict.postWorkspace.text.subtitleLabel} value={current?.subtitle} art />
              <Read label={dict.postWorkspace.text.captionLabel} value={current?.instagramCaption} />
            </dl>
          )}

          {post.credits.length > 0 && (
            <div className="border-t border-lineSoft pt-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {dict.postWorkspace.text.creditsHeading}
              </dt>
              <ul className="mt-1 space-y-0.5 text-sm text-ink">
                {post.credits.map((c, i) => (
                  <li key={i}>{formatCredit(c)}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ───────────── STEP 2: IMAGE ───────────── */}
      {step === "image" && (
        <section className="card p-4 sm:p-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <span aria-hidden>{isVideoPost ? "▶️" : "📷"}</span>
            {dict.postWorkspace.image.heading}
          </h2>
          <p className="hint mb-4 mt-0">
            {dict.postWorkspace.image.hint}
          </p>

          {!canEdit ? (
            // A peer reviewing: view only, does not touch another person's photo/video.
            <div className="space-y-4">
              {isVideoPost ? (
                current?.renderedVideoUrl ? (
                  <video
                    src={current.renderedVideoUrl}
                    controls
                    className="mx-auto max-h-[420px] w-full rounded-xl border border-line bg-black"
                  />
                ) : (
                  <EmptyNote>
                    {hasVideos
                      ? dict.postWorkspace.image.videoUploadedNoRender
                      : dict.postWorkspace.image.noVideoReadOnly}
                  </EmptyNote>
                )
              ) : current?.renderedArtUrl && current.renderedSlideUrls.length > 0 ? (
                <div className="mx-auto max-w-[420px] overflow-hidden rounded-xl border border-line">
                  <CarouselTrack
                    urls={[current.renderedArtUrl, ...current.renderedSlideUrls]}
                    aspectRatio={previewRatio ?? 1080 / 1350}
                  />
                </div>
              ) : current?.renderedArtUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.renderedArtUrl}
                  alt={dict.postWorkspace.image.artAlt}
                  className="mx-auto max-w-[420px] rounded-xl border border-line"
                />
              ) : (
                <EmptyNote>
                  {hasPhotos
                    ? dict.postWorkspace.image.photoUploadedNoArt
                    : dict.postWorkspace.image.noPhotoReadOnly}
                </EmptyNote>
              )}
              <ImageSuggestions suggestions={current?.imageSuggestions ?? []} />
            </div>
          ) : !hasPhotos && !hasVideos ? (
            <div className="space-y-4">
              <EmptyNote>
                {dict.postWorkspace.image.noPhotoEditable}
              </EmptyNote>
              <div className="grid gap-3 sm:grid-cols-2">
                <PhotoUploader
                  dragging={photoDragging}
                  busy={photoBusy}
                  onDragOver={() => setPhotoDragging(true)}
                  onDragLeave={() => setPhotoDragging(false)}
                  onDrop={(f) => { setPhotoDragging(false); addPhoto(f); }}
                  onPick={() => photoInputRef.current?.click()}
                />
                <VideoUploader
                  dragging={videoDragging}
                  busy={videoBusy}
                  onDragOver={() => setVideoDragging(true)}
                  onDragLeave={() => setVideoDragging(false)}
                  onDrop={(f) => { setVideoDragging(false); addVideo(f); }}
                  onPick={() => videoInputRef.current?.click()}
                />
              </div>
              <CarouselButton busy={carouselBusy} onClick={openCarouselPicker} />
              {photoError && <p className="alert-error">{photoError}</p>}
              {videoError && <p className="alert-error">{videoError}</p>}
              {carouselError && <p className="alert-error">{carouselError}</p>}
              <ImageSuggestions
                suggestions={current?.imageSuggestions ?? []}
                onSearchPhotos={setPhotoPickerQuery}
              />
            </div>
          ) : isVideoPost ? (
            <div className="space-y-4">
              <details className="group card-soft p-3">
                <summary className="btn-ghost w-full cursor-pointer list-none">
                  {dict.postWorkspace.image.addOrChangeVideo}
                </summary>
                <div className="mt-3 space-y-3">
                  <VideoUploader
                    dragging={videoDragging}
                    busy={videoBusy}
                    compact
                    onDragOver={() => setVideoDragging(true)}
                    onDragLeave={() => setVideoDragging(false)}
                    onDrop={(f) => { setVideoDragging(false); addVideo(f); }}
                    onPick={() => videoInputRef.current?.click()}
                  />
                  {videoError && <p className="alert-error">{videoError}</p>}
                </div>
              </details>

              {/* Carousels take photos only — blocked (and explained) on a video post. */}
              <CarouselButton disabled note={dict.carousel.videoBlocked} onClick={() => {}} />

              <VideoEditor
                key={post.videos.map((v) => v.id).join(",")}
                postId={post.id}
                videos={post.videos}
                companyLogoUrl={company.logoUrl}
                companyBrandColors={{ dark: company.brandColorDark, light: company.brandColorLight }}
                initial={{
                  selectedVideoId: lastAddedVideoId ?? current?.selectedVideoId,
                  title: current?.title,
                  titleOffsetY: current?.titleOffset?.offsetY,
                  videoTemplate: current?.videoTemplate,
                }}
                onSaved={() => {
                  setStepOverride(null);
                  router.refresh();
                }}
              />
            </div>
          ) : !hasTemplates ? (
            <EmptyNote>
              {dict.postWorkspace.image.noTemplatePrefix}{" "}
              <strong className="text-ink">{dict.postWorkspace.image.noTemplateAdminPath}</strong>.
            </EmptyNote>
          ) : (
            <div className="space-y-4">
              <details className="group card-soft p-3">
                <summary className="btn-ghost w-full cursor-pointer list-none">
                  {dict.postWorkspace.image.addOrChangePhoto}
                </summary>
                <div className="mt-3 space-y-3">
                  <PhotoUploader
                    dragging={photoDragging}
                    busy={photoBusy}
                    compact
                    onDragOver={() => setPhotoDragging(true)}
                    onDragLeave={() => setPhotoDragging(false)}
                    onDrop={(f) => { setPhotoDragging(false); addPhoto(f); }}
                    onPick={() => photoInputRef.current?.click()}
                  />
                  {photoError && <p className="alert-error">{photoError}</p>}
                  <ImageSuggestions
                    suggestions={current?.imageSuggestions ?? []}
                    onSearchPhotos={setPhotoPickerQuery}
                  />
                </div>
              </details>

              {!carousel && <CarouselButton busy={carouselBusy} onClick={openCarouselPicker} />}
              {carouselError && <p className="alert-error">{carouselError}</p>}

              <ArtEditor
                // In a carousel only the cover remounts the editor: adding,
                // framing or editing photos 2..N keeps the title being typed.
                key={carousel ? `carousel:${carousel.coverId}` : post.photos.map((p) => p.id).join(",")}
                postId={post.id}
                photos={post.photos}
                templates={templates}
                carouselSlides={carousel?.slides}
                onDraft={rememberDraft}
                onEditPhoto={async (file) => {
                  setCarry(draftRef.current);
                  await addPhoto(file);
                }}
                renderCarousel={
                  carousel
                    ? (canvas, coverSlot) => (
                        <CarouselManager
                          cover={post.photos.find((p) => p.id === carousel.coverId)}
                          slides={carousel.slides}
                          photos={post.photos}
                          canvas={canvas}
                          busy={carouselBusy}
                          onChange={(slides) => setCarousel({ ...carousel, slides })}
                          onMakeCover={makeCover}
                          onAddPhotos={openCarouselPicker}
                          onExit={exitCarousel}
                          onReplacePhoto={replaceCarouselPhoto}
                          editAction={(photo, replace) => (
                            <PhotoEditButton
                              photoUrl={photo.storageUrl}
                              // The cover sits in the template's photo slot; the other slides fill the whole canvas.
                              frame={photo.id === carousel.coverId ? coverSlot : canvas}
                              disabled={carouselBusy}
                              onApply={(file) => {
                                setCarry(draftRef.current);
                                return replace(file);
                              }}
                            />
                          )}
                        />
                      )
                    : undefined
                }
                initial={{
                  selectedPhotoId: coverPhotoId,
                  artTemplateId: carry?.templateId ?? current?.artTemplateId,
                  photoTransform:
                    coverPhotoId && coverPhotoId === current?.selectedPhotoId
                      ? current?.photoTransform
                      : null,
                  title: carry?.title ?? current?.title,
                  subtitle: carry?.subtitle ?? current?.subtitle,
                  titleOffset: current?.titleOffset,
                  subtitleOffset: current?.subtitleOffset,
                }}
                onSaved={() => {
                  setCarry(null);
                  setStepOverride(null);
                  router.refresh();
                }}
              />
            </div>
          )}
          {canEdit && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => addPhoto(e.target.files?.[0])}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => addVideo(e.target.files?.[0])}
              />
              {/* `accept` only filters the picker — a video that still gets through
                  (drag-and-drop, "all files") is refused in addCarouselPhotos. */}
              <input
                ref={carouselInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  addCarouselPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </section>
      )}

      {/* ───────────── STEP 3: REVIEW ───────────── */}
      {step === "review" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Preview */}
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">{dict.postWorkspace.review.previewHeading}</h2>
            <InstagramPreview
              artUrl={current?.renderedArtUrl}
              videoUrl={current?.renderedVideoUrl}
              slideUrls={current?.renderedSlideUrls}
              caption={current?.instagramCaption}
              aspectRatio={previewRatio}
              handle={company.instagramHandle ?? company.name ?? undefined}
              logoUrl={company.logoUrl ?? undefined}
            />
          </section>

          <div className="space-y-5">
            {/* Decision — one clear primary action per role, the rest stays discreet. */}
            {!isFinished && (
              <section className="card p-4">
                <h2 className="mb-3 text-sm font-semibold">{dict.postWorkspace.review.decisionHeading}</h2>

                {isManagerOrAdmin && (
                  <button
                    className="btn-success w-full"
                    onClick={approve}
                    disabled={!!busy || !mediaReady}
                  >
                    {busy ? <BusyLabel label={busy} seconds={elapsed} /> : dict.postWorkspace.review.approveAndPublish}
                  </button>
                )}

                {isPeerReviewer && (
                  <>
                    <p className="hint mb-2 mt-0">
                      {approvals.length}/{PEER_APPROVALS_NEEDED}{" "}
                      {dict.postWorkspace.review.peerApprovedMiddle}{" "}
                      {PEER_APPROVALS_NEEDED}
                      {dict.postWorkspace.review.peerApprovedEnd}
                    </p>
                    <button
                      className="btn-success w-full"
                      onClick={approve}
                      disabled={!!busy || !mediaReady || !!myApproval}
                    >
                      {busy ? (
                        <BusyLabel label={busy} seconds={elapsed} />
                      ) : myApproval ? (
                        dict.postWorkspace.review.alreadyApproved
                      ) : (
                        dict.postWorkspace.review.approveThisStory
                      )}
                    </button>
                  </>
                )}

                {isAuthor && !isManagerOrAdmin && (
                  <p className="alert-info">
                    {approvals.length > 0 ? (
                      <>
                        {dict.postWorkspace.review.waitingWithCountPrefix} {approvals.length}/
                        {PEER_APPROVALS_NEEDED} {dict.postWorkspace.review.waitingWithCountSuffix}
                      </>
                    ) : (
                      <>
                        {dict.postWorkspace.review.waitingNoCountPrefix} {PEER_APPROVALS_NEEDED}{" "}
                        {dict.postWorkspace.review.waitingNoCountSuffix}
                      </>
                    )}
                  </p>
                )}

                {!mediaReady && (
                  <p className="hint">
                    {dict.postWorkspace.review.artNotReady}
                  </p>
                )}

                {(canEdit || isPeerReviewer || canDecide) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(canEdit || isPeerReviewer) && (
                      <Decision
                        icon="🔄" title={dict.postWorkspace.review.rewriteTitle}
                        desc={dict.postWorkspace.review.rewriteDesc}
                        disabled={!!busy}
                        onClick={() => setPanel(panel === "rewrite" ? null : "rewrite")}
                      />
                    )}
                    {canDecide && (
                      <Decision
                        icon="🚫" title={dict.postWorkspace.review.rejectTitle}
                        desc={dict.postWorkspace.review.rejectDesc}
                        tone="danger"
                        disabled={!!busy}
                        onClick={() => setPanel(panel === "reject" ? null : "reject")}
                      />
                    )}
                  </div>
                )}

                {panel === "rewrite" && (
                  <div className="mt-3 space-y-2 rounded-xl border border-line bg-elevated p-3 animate-fade-in">
                    <label className="label" htmlFor="guidance">
                      {dict.postWorkspace.review.guidanceLabel}
                    </label>
                    <input
                      id="guidance" className="input" value={guidance}
                      onChange={(e) => setGuidance(e.target.value)}
                      placeholder={dict.postWorkspace.review.guidancePlaceholder}
                    />
                    <button className="btn-primary w-full" onClick={rewrite} disabled={!!busy}>
                      {busy ? <BusyLabel label={busy} seconds={elapsed} /> : dict.postWorkspace.review.rewriteButton}
                    </button>
                    {busy && elapsed >= 8 && (
                      <p className="text-center text-xs text-muted">
                        {dict.postWorkspace.review.aiSlowNotice}
                      </p>
                    )}
                  </div>
                )}

                {panel === "reject" && (
                  <div className="mt-3 space-y-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3 animate-fade-in">
                    <label className="label" htmlFor="reason">{dict.postWorkspace.review.reasonLabel}</label>
                    <input
                      id="reason" className="input" value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={dict.postWorkspace.review.reasonPlaceholder}
                    />
                    <button
                      className="btn-danger w-full" onClick={reject}
                      disabled={!!busy || reason.trim().length < 3}
                    >
                      {busy ? <BusyLabel label={busy} seconds={elapsed} /> : dict.postWorkspace.review.confirmRejectButton}
                    </button>
                  </div>
                )}
              </section>
            )}

            {isFinished && (
              <section className="card p-4">
                <p className="text-sm">
                  {post.status === POST_STATUS.PUBLISHED
                    ? dict.postWorkspace.review.publishedMessage
                    : dict.postWorkspace.review.rejectedMessage}
                </p>
              </section>
            )}

            {/* History */}
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-semibold">
                {dict.postWorkspace.history.heading} ({post.versions.length})
              </h2>
              <ol className="space-y-2.5">
                {post.versions.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">v{v.versionNumber}</span>{" "}
                      <span className="text-muted">· {originLabel(v.origin, dict.postWorkspace.origin)}</span>
                      {v.aiProvider && (
                        <span className="text-muted"> · {aiSourceLabel(v.aiProvider, dict.postWorkspace.aiSource)}</span>
                      )}
                      {v.decisions.map((d) => (
                        <div key={d.id} className="text-xs text-muted">
                          {decisionLabel(d.decision, dict.postWorkspace.decision)} {dict.postWorkspace.header.byLabel}{" "}
                          {d.reviewer.name}
                          {d.reason ? ` — “${d.reason}”` : ""}
                        </div>
                      ))}
                    </div>
                    <span className="shrink-0 text-xs text-faint">
                      {new Date(v.createdAt).toLocaleString(dateLocale, {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}

      {photoPickerQuery !== null && (
        <PhotoPickerModal
          key={photoPickerQuery}
          initialQuery={photoPickerQuery}
          onClose={() => setPhotoPickerQuery(null)}
          onPick={importPexelsPhoto}
        />
      )}
    </div>
  );
}

// ── UI pieces ────────────────────────────────────────────────

function Decision({
  icon, title, desc, onClick, disabled, tone,
}: {
  icon: string; title: string; desc: string;
  onClick: () => void; disabled?: boolean;
  tone?: "success" | "danger";
}) {
  const ring =
    tone === "success"
      ? "hover:border-emerald-500/60 hover:bg-emerald-500/10"
      : tone === "danger"
        ? "hover:border-red-500/60 hover:bg-red-500/10"
        : "hover:border-brand-500/60 hover:bg-brand-500/10";
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`flex items-start gap-3 rounded-xl border border-line bg-elevated p-3
                  text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${ring}`}
    >
      <span aria-hidden className="text-lg leading-none">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </button>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="alert-info">{children}</p>;
}

/**
 * Photo upload right on the review screen — for the case where the reporter
 * only decides on the image after seeing the finished text (found a better one,
 * downloaded from Google or from a free library). Accepts drag-and-drop or the
 * traditional button; it is never the only way to add a photo, just one more.
 */
function PhotoUploader({
  dragging, busy, compact, onDragOver, onDragLeave, onDrop, onPick,
}: {
  dragging: boolean;
  busy: boolean;
  compact?: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (file: File | undefined) => void;
  onPick: () => void;
}) {
  const { dict } = useLocale();
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files?.[0]); }}
      onClick={onPick}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl
                  border-2 border-dashed text-center transition-colors ${
                    compact ? "px-3 py-4" : "px-4 py-8"
                  } ${
                    dragging
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-line bg-elevated/60 hover:border-brand-500/60"
                  }`}
    >
      <span aria-hidden className="text-2xl">📷</span>
      <p className="text-sm font-medium">
        {busy ? dict.postWorkspace.photoUploader.sending : dict.postWorkspace.photoUploader.dragOrTap}
      </p>
      <p className="text-xs text-muted">
        {dict.postWorkspace.photoUploader.formatsPrefix} {MAX_PHOTO_MB} {dict.postWorkspace.photoUploader.mbSuffix}
      </p>
    </div>
  );
}

/**
 * "Carousel" entry, right under the photo/video uploaders. Disabled with an
 * explanation on a video post — carousels take photos only.
 */
function CarouselButton({
  onClick, busy, disabled, note,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  note?: string;
}) {
  const { dict } = useLocale();
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        className="flex w-full flex-col items-center gap-0.5 rounded-xl border border-line bg-elevated/60 px-4 py-3
                   text-center transition-colors hover:border-brand-500/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="text-sm font-medium">{dict.carousel.button}</span>
        <span className="text-xs text-muted">
          {dict.carousel.buttonHint.replace("{max}", String(CAROUSEL_MAX))}
        </span>
      </button>
      {note && <p className="hint my-0 text-center">{note}</p>}
    </div>
  );
}

/** Same idea as PhotoUploader, for video (different format/ceiling). */
function VideoUploader({
  dragging, busy, compact, onDragOver, onDragLeave, onDrop, onPick,
}: {
  dragging: boolean;
  busy: boolean;
  compact?: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (file: File | undefined) => void;
  onPick: () => void;
}) {
  const { dict } = useLocale();
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files?.[0]); }}
      onClick={onPick}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl
                  border-2 border-dashed text-center transition-colors ${
                    compact ? "px-3 py-4" : "px-4 py-8"
                  } ${
                    dragging
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-line bg-elevated/60 hover:border-brand-500/60"
                  }`}
    >
      <span aria-hidden className="text-2xl">▶️</span>
      <p className="text-sm font-medium">
        {busy ? dict.postWorkspace.videoUploader.sending : dict.postWorkspace.videoUploader.dragOrTap}
      </p>
      <p className="text-xs text-muted">
        {dict.postWorkspace.videoUploader.formatsPrefix} {MAX_VIDEO_MB} {dict.postWorkspace.videoUploader.mbSuffix}
      </p>
    </div>
  );
}

/**
 * Exactly 2 search suggestions generated by the AI — they only help find an
 * image; they never choose, download or publish anything by themselves.
 *
 * "Google Images" always opens in a new tab — Google's results page blocks
 * iframes and there is no equivalent free API, so the real photo of the event
 * can be found, but not embedded/automated.
 *
 * "Free photos" (Pexels) is already embedded when `onSearchPhotos` is passed
 * (opens the PhotoPickerModal — search, pick, the photo goes straight into the
 * art, without leaving the site). Without that callback (peer review, view
 * only), it falls back to the usual link in a new tab.
 */
function ImageSuggestions({
  suggestions,
  onSearchPhotos,
}: {
  suggestions: string[];
  onSearchPhotos?: (query: string) => void;
}) {
  const { dict } = useLocale();
  if (!suggestions.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">
        {dict.postWorkspace.imageSuggestions.heading}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.slice(0, 2).map((q) => (
          <div key={q} className="card-soft space-y-2 p-3">
            <p className="truncate text-sm font-medium text-ink" title={q}>
              “{q}”
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={googleImagesUrl(q)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm gap-1.5"
              >
                <GoogleIcon />
                {dict.postWorkspace.imageSuggestions.googleImages}
              </a>
              {onSearchPhotos ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => onSearchPhotos(q)}
                >
                  {dict.postWorkspace.imageSuggestions.freePhotos}
                </button>
              ) : (
                <a
                  href={freePhotosUrl(q)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost btn-sm"
                >
                  {dict.postWorkspace.imageSuggestions.freePhotos}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Official multicolor Google logo — keeps the brand colors in any theme. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.617z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

interface PexelsPhoto {
  id: number;
  thumbnailUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
  alt: string;
}

type PhotoSearchResponse =
  | { enabled: false }
  | { enabled: true; photos: PexelsPhoto[]; nextPage: number | null };

/**
 * Built-in Pexels search, opened from an AI suggestion (query already filled
 * in, editable). Shows the photo grid without leaving the site; clicking one
 * already downloads it (server-side, via /photo-search/import) and attaches it
 * to the post (`onPick`, the same ending as the normal addPhoto). Without
 * PEXELS_API_KEY configured, it falls back to the usual link in a new tab.
 */
function PhotoPickerModal({
  initialQuery,
  onClose,
  onPick,
}: {
  initialQuery: string;
  onClose: () => void;
  onPick: (downloadUrl: string) => Promise<boolean>;
}) {
  const { dict } = useLocale();
  const t = dict.postWorkspace.photoPicker;
  const [q, setQ] = useState(initialQuery);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingId, setPickingId] = useState<number | null>(null);

  const search = useCallback(async (query: string, page: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<PhotoSearchResponse>(
        `/api/photo-search?q=${encodeURIComponent(query)}&page=${page}`,
      );
      if (!res.enabled) {
        setEnabled(false);
        return;
      }
      setPhotos((prev) => (append ? [...prev, ...res.photos] : res.photos));
      setNextPage(res.nextPage);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(initialQuery, 1, false);
    // Only on open — later searches (new term, "load more") come from explicit
    // user actions, not from a prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The import error shows in the progress modal (ActionOverlay), not here —
  // if it failed, the picker just goes back to normal so the person picks another.
  async function pick(photo: PexelsPhoto) {
    setPickingId(photo.id);
    setError(null);
    const ok = await onPick(photo.downloadUrl);
    if (ok) onClose();
    else setPickingId(null);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[85vh] w-full max-w-2xl flex-col p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-picker-title"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="photo-picker-title" className="text-sm font-semibold">
              🖼️ {t.title}
            </h2>
            <p className="hint mb-0 mt-0.5">{t.subtitle}</p>
          </div>
          <button
            type="button"
            className="btn-subtle btn-sm shrink-0"
            onClick={onClose}
            aria-label={t.closeLabel}
          >
            ✕
          </button>
        </div>

        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search(q, 1, false);
          }}
        >
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchPlaceholder}
          />
          <button type="submit" className="btn-primary shrink-0" disabled={loading || !q.trim()}>
            {t.searchButton}
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!enabled ? (
            <div className="alert-info space-y-2">
              <p className="font-medium">{t.notConfiguredTitle}</p>
              <p>{t.notConfiguredBody}</p>
              <a
                href={freePhotosUrl(initialQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm"
              >
                {t.openInNewTab}
              </a>
            </div>
          ) : (
            <>
              {error && <p className="alert-error mb-3">{error}</p>}
              {loading && photos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">{t.loading}</p>
              ) : photos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">{t.empty}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => pick(photo)}
                      disabled={pickingId !== null}
                      title={photo.alt}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-elevated transition-opacity disabled:cursor-wait"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbnailUrl}
                        alt={photo.alt}
                        loading="lazy"
                        className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${
                          pickingId === photo.id ? "opacity-40" : ""
                        }`}
                      />
                      {pickingId === photo.id && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
                          {t.importing}
                        </span>
                      )}
                      {photo.photographer && (
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-left text-[10px] text-white/90">
                          {t.photoCreditPrefix}{photo.photographer}{t.photoCreditSuffix}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {nextPage !== null && photos.length > 0 && (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={loading}
                    onClick={() => search(q, nextPage, true)}
                  >
                    {loading ? t.loadingMore : t.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label, value, onChange, textarea, max, rows = 3,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  textarea?: boolean; max?: number; rows?: number;
}) {
  const over = max !== undefined && value.length > max;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label">{label}</label>
        {max !== undefined && (
          <span className={`text-xs tabular-nums ${over ? "text-red-400" : "text-faint"}`}>
            {value.length}/{max}
          </span>
        )}
      </div>
      {textarea ? (
        <textarea
          className="input resize-y" rows={rows} value={value} maxLength={max}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input" value={value} maxLength={max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function Read({
  label, value, art,
}: { label: string; value?: string | null; art?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </dt>
      <dd
        className={`mt-0.5 whitespace-pre-wrap break-words text-sm text-ink ${
          art ? "font-art" : ""
        }`}
      >
        {value || <span className="text-faint">—</span>}
      </dd>
    </div>
  );
}

/**
 * Friendly name of the provider that generated the text. Providers inside the
 * fallback chain arrive as "openrouter:model" — extracts only the name.
 */
function aiSourceLabel(provider: string, names: Record<string, string>): string {
  const base = provider.split(":")[0];
  return names[base] ?? base;
}

function originLabel(origin: string, origins: Record<string, string>): string {
  return origins[origin] ?? origin;
}

function decisionLabel(decision: string, decisions: Record<string, string>): string {
  return decisions[decision] ?? decision;
}
