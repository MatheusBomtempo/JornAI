"use client";

import { useState, type ReactNode } from "react";
import { useLocale } from "./LocaleProvider";
import { SlideFramer } from "./SlideFramer";
import type { EditorPhoto } from "./ArtEditor";
import { CAROUSEL_MAX } from "@/lib/domain";
import { slideImageBox, type CarouselSlide } from "@/lib/carousel";

interface Props {
  cover: EditorPhoto | undefined;
  slides: CarouselSlide[];
  photos: EditorPhoto[];
  /** Live size of the active template — every carousel item uses its proportion. */
  canvas: { width: number; height: number };
  busy?: boolean;
  onChange: (slides: CarouselSlide[]) => void;
  /** Swaps slide `index` (0-based among slides) with the current cover. */
  onMakeCover: (index: number) => void;
  onAddPhotos: () => void;
  onExit: () => void;
  /**
   * Hook for the photo editor (blur): rendered next to each photo's buttons
   * when given. `replace` uploads the edited file as a new photo and puts it in
   * the same position (the original stays untouched).
   */
  editAction?: (photo: EditorPhoto, replace: (file: File) => Promise<void>) => ReactNode;
  onReplacePhoto: (photoId: string, file: File) => Promise<void>;
}

/**
 * Carousel strip under the cover editor: order, cover badge, reorder, make
 * cover, per-photo framing, remove and add more. The cover itself is framed in
 * the big editor above (it is the only item with template and text).
 */
export function CarouselManager({
  cover,
  slides,
  photos,
  canvas,
  busy,
  onChange,
  onMakeCover,
  onAddPhotos,
  onExit,
  editAction,
  onReplacePhoto,
}: Props) {
  const { dict } = useLocale();
  const t = dict.carousel;
  const [framing, setFraming] = useState<number | null>(null);
  const total = (cover ? 1 : 0) + slides.length;
  const byId = new Map(photos.map((p) => [p.id, p]));

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  }

  const framingSlide = framing !== null ? slides[framing] : null;
  const framingPhoto = framingSlide ? byId.get(framingSlide.photoId) : undefined;

  return (
    <div className="card-soft space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">🗂️ {t.heading}</h3>
        <span className="text-xs tabular-nums text-muted">
          {t.counter.replace("{count}", String(total)).replace("{max}", String(CAROUSEL_MAX))}
        </span>
      </div>

      <div className="alert-info space-y-1">
        <p className="font-semibold">⚠️ {t.warningTitle}</p>
        <p>{t.warningBody}</p>
      </div>

      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {cover && (
          <figure className="w-28 shrink-0 snap-start space-y-1.5">
            <div
              className="relative overflow-hidden rounded-lg border-2 border-brand-500 bg-black"
              style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.storageUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                1 · {t.coverBadge}
              </span>
            </div>
            {editAction?.(cover, (file) => onReplacePhoto(cover.id, file))}
          </figure>
        )}

        {slides.map((slide, i) => {
          const photo = byId.get(slide.photoId);
          if (!photo) return null;
          return (
            <figure key={slide.photoId} className="w-28 shrink-0 snap-start space-y-1.5">
              <button
                type="button"
                onClick={() => setFraming(i)}
                title={t.frame}
                className="relative block w-full overflow-hidden rounded-lg border border-line bg-black hover:border-brand-500/60"
                style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
              >
                <SlideThumb url={photo.storageUrl} slide={slide} canvas={canvas} />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {i + 2}
                </span>
              </button>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-subtle btn-sm flex-1 px-0"
                  disabled={i === 0 || busy}
                  onClick={() => move(i, -1)}
                  aria-label={t.moveLeft}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="btn-subtle btn-sm flex-1 px-0"
                  disabled={i === slides.length - 1 || busy}
                  onClick={() => move(i, 1)}
                  aria-label={t.moveRight}
                >
                  →
                </button>
              </div>
              <button type="button" className="btn-ghost btn-sm w-full" disabled={busy} onClick={() => onMakeCover(i)}>
                {t.makeCover}
              </button>
              <button type="button" className="btn-ghost btn-sm w-full" disabled={busy} onClick={() => setFraming(i)}>
                {t.frame}
              </button>
              {editAction?.(photo, (file) => onReplacePhoto(photo.id, file))}
              <button
                type="button"
                className="btn-subtle btn-sm w-full text-red-400"
                disabled={busy}
                onClick={() => onChange(slides.filter((_, j) => j !== i))}
              >
                {t.remove}
              </button>
            </figure>
          );
        })}

        {total < CAROUSEL_MAX && (
          <button
            type="button"
            onClick={onAddPhotos}
            disabled={busy}
            className="flex w-28 shrink-0 snap-start items-center self-start justify-center rounded-lg border-2 border-dashed border-line bg-elevated/60 px-2 text-center text-xs font-medium text-muted hover:border-brand-500/60 disabled:opacity-40"
            style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
          >
            {t.addPhotos}
          </button>
        )}
      </div>

      {slides.length === 0 && <p className="hint my-0">{t.onlyOne}</p>}

      <button
        type="button"
        className="btn-subtle btn-sm w-full"
        disabled={busy}
        onClick={() => {
          if (slides.length === 0 || window.confirm(t.exitConfirm)) onExit();
        }}
      >
        {t.exit}
      </button>

      {framing !== null && framingSlide && framingPhoto && (
        <SlideFramer
          photoUrl={framingPhoto.storageUrl}
          index={framing + 2}
          canvas={canvas}
          initial={framingSlide.transform}
          onClose={() => setFraming(null)}
          onApply={(transform) => {
            onChange(slides.map((s, j) => (j === framing ? { ...s, transform } : s)));
            setFraming(null);
          }}
        />
      )}
    </div>
  );
}

/** Thumbnail with the slide's own framing — same math as the final render. */
function SlideThumb({
  url,
  slide,
  canvas,
}: {
  url: string;
  slide: CarouselSlide;
  canvas: { width: number; height: number };
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      draggable={false}
      onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
      className="absolute max-w-none"
      style={size ? slideImageBox(slide.transform, size, canvas) : { inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
