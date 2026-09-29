"use client";

import { useLocale } from "./LocaleProvider";

interface Props {
  artUrl?: string | null;
  /** Video post: really plays in the preview — the review has to watch it before approving. */
  videoUrl?: string | null;
  caption?: string | null;
  handle?: string;
  /** Company logo (onboarding) — replaces the generic avatar when present. */
  logoUrl?: string | null;
  /**
   * Width/height proportion of the template (e.g. 1080/1350 for 4:5,
   * 1080/1080 for 1:1, 1080/1920 for video). Without it, the preview assumes a
   * square and crops the image when the post is 4:5 — always pass the real
   * size of the template.
   */
  aspectRatio?: number;
}

/** Mockup of an Instagram feed post for the review screen. */
export function InstagramPreview({
  artUrl,
  videoUrl,
  caption,
  handle,
  logoUrl,
  aspectRatio = 1080 / 1350,
}: Props) {
  const { dict } = useLocale();
  const resolvedHandle = handle ?? dict.instagramPreview.defaultHandle;
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-elevated">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-400 via-red-500 to-purple-600" />
        )}
        <span className="text-sm font-semibold">{resolvedHandle}</span>
        <span className="ml-auto text-muted" aria-hidden>···</span>
      </div>

      {/* The proportion matches the template exactly, so nothing is cropped. */}
      <div className="bg-black" style={{ aspectRatio }}>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        ) : artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artUrl}
            alt={dict.instagramPreview.artAlt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-faint">
            {dict.instagramPreview.artPlaceholder}
          </div>
        )}
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex gap-3.5 text-[17px]" aria-hidden>
          <span>♡</span>
          <span>💬</span>
          <span>↪</span>
        </div>
        {caption && (
          <p className="whitespace-pre-wrap break-words text-sm leading-snug">
            <span className="font-semibold">{resolvedHandle}</span>{" "}
            <span className="text-ink/90">{caption}</span>
          </p>
        )}
      </div>
    </div>
  );
}
