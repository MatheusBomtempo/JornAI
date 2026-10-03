"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "./LocaleProvider";
import {
  clampSlideTransform,
  slideImageBox,
  DEFAULT_SLIDE_TRANSFORM,
  SLIDE_ZOOM_MAX,
  type SlideTransform,
} from "@/lib/carousel";

/**
 * Popup to frame one carousel photo (2..N): drag to pan + zoom slider, inside
 * a box with the cover's proportion. No Fabric — the photo is a plain <img>
 * positioned with the same math as the server render (lib/carousel.ts), so
 * what is seen here is what gets published.
 */
export function SlideFramer({
  photoUrl,
  index,
  canvas,
  initial,
  onClose,
  onApply,
}: {
  photoUrl: string;
  /** 1-based position in the carousel, only for the title. */
  index: number;
  canvas: { width: number; height: number };
  initial: SlideTransform;
  onClose: () => void;
  onApply: (t: SlideTransform) => void;
}) {
  const { dict } = useLocale();
  const t = dict.carousel.framer;
  const boxRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState<SlideTransform>(initial);
  const drag = useRef<{ x: number; y: number; start: SlideTransform } | null>(null);

  // Escape closes; the page behind does not scroll while the popup is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const clamp = (next: SlideTransform) => (img ? clampSlideTransform(next, img, canvas) : next);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: transform };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const box = boxRef.current;
    if (!d || !box) return;
    // Screen pixels → canvas pixels (the units the render uses).
    const k = canvas.width / box.clientWidth;
    setTransform(
      clamp({
        ...d.start,
        offsetX: d.start.offsetX + (e.clientX - d.x) * k,
        offsetY: d.start.offsetY + (e.clientY - d.y) * k,
      }),
    );
  }

  function endDrag() {
    drag.current = null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-framer-title"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="slide-framer-title" className="text-sm font-semibold">
              {t.title.replace("{index}", String(index))}
            </h2>
            <p className="hint mb-0 mt-0.5">{t.hint}</p>
          </div>
          <button type="button" className="btn-subtle btn-sm shrink-0" onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </div>

        <div
          ref={boxRef}
          className="relative mx-auto w-full max-w-[360px] cursor-grab touch-none select-none overflow-hidden rounded-xl border border-line bg-black active:cursor-grabbing"
          style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const size = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight };
              setImg(size);
              setTransform((prev) => clampSlideTransform(prev, size, canvas));
            }}
            className="pointer-events-none absolute max-w-none"
            style={img ? slideImageBox(transform, img, canvas) : { opacity: 0 }}
          />
          {!img && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-faint">{t.loading}</p>
          )}
        </div>

        <div className="card-soft mt-3 p-3">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="slide-zoom" className="text-xs font-medium text-muted">{t.zoom}</label>
            <span className="text-xs tabular-nums text-faint">{transform.scale.toFixed(2)}×</span>
          </div>
          <input
            id="slide-zoom"
            type="range"
            min={1}
            max={SLIDE_ZOOM_MAX}
            step={0.01}
            value={transform.scale}
            disabled={!img}
            onChange={(e) => {
              // Zooms around the center of the frame, like the cover editor.
              const next = Number(e.target.value);
              const ratio = next / transform.scale;
              setTransform(
                clamp({ scale: next, offsetX: transform.offsetX * ratio, offsetY: transform.offsetY * ratio }),
              );
            }}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand-500"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setTransform(DEFAULT_SLIDE_TRANSFORM)}>
            {t.center}
          </button>
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={!img}
            onClick={() => onApply(clamp(transform))}
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
