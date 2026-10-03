"use client";

import { useRef, useState } from "react";
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
  /**
   * Carousel: the photos after the cover (artUrl), in order. With any, the
   * media area becomes a swipeable carousel like Instagram's.
   */
  slideUrls?: string[];
}

/** Mockup of an Instagram feed post for the review screen. */
export function InstagramPreview({
  artUrl,
  videoUrl,
  caption,
  handle,
  logoUrl,
  aspectRatio = 1080 / 1350,
  slideUrls = [],
}: Props) {
  const { dict } = useLocale();
  const resolvedHandle = handle ?? dict.instagramPreview.defaultHandle;
  const isCarousel = !videoUrl && !!artUrl && slideUrls.length > 0;
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

      {/* The proportion matches the template exactly, so nothing is cropped.
          A carousel sizes itself (each item has the proportion, plus the dots row). */}
      <div className="bg-black" style={isCarousel ? undefined : { aspectRatio }}>
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        ) : isCarousel && artUrl ? (
          <CarouselTrack urls={[artUrl, ...slideUrls]} aspectRatio={aspectRatio} />
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

/**
 * Swipeable carousel in Instagram's style: native horizontal scroll with snap
 * (finger swipe on phones, trackpad on desktop), arrows on hover, "1/N" in the
 * corner and the dots under the media. Also used outside the feed mockup (read
 * only view of the media step).
 */
export function CarouselTrack({ urls, aspectRatio }: { urls: string[]; aspectRatio: number }) {
  const { dict } = useLocale();
  const t = dict.carousel;
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function goTo(index: number) {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.max(0, Math.min(urls.length - 1, index));
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="group relative">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((url, i) => (
          <div key={url} className="w-full shrink-0 snap-center snap-always bg-black" style={{ aspectRatio }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={t.slideAlt.replace("{index}", String(i + 1))}
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
        {t.previewCounter.replace("{index}", String(active + 1)).replace("{total}", String(urls.length))}
      </span>

      {active > 0 && (
        <button
          type="button"
          onClick={() => goTo(active - 1)}
          aria-label={t.previous}
          className="absolute left-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-sm font-bold text-black shadow opacity-0 transition-opacity group-hover:opacity-100 sm:flex"
        >
          ‹
        </button>
      )}
      {active < urls.length - 1 && (
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          aria-label={t.next}
          className="absolute right-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-sm font-bold text-black shadow opacity-0 transition-opacity group-hover:opacity-100 sm:flex"
        >
          ›
        </button>
      )}

      <div className="flex justify-center gap-1 bg-elevated py-2" aria-hidden>
        {urls.map((url, i) => (
          <span
            key={url}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${i === active ? "bg-sky-500" : "bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
