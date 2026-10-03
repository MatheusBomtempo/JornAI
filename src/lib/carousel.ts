/**
 * Carousel geometry shared by the browser (thumbnails + SlideFramer) and the
 * server render (renderSlideAndStore → renderPhotoIntoSlot): the photo covers
 * the whole canvas at scale 1, `scale` zooms on top of that and the offsets
 * are canvas pixels from the centered position — the same units as the cover's
 * photoTransform. Kept free of server/browser imports on purpose.
 */

export interface SlideTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/** One carousel photo after the cover (photos 2..N). */
export interface CarouselSlide {
  photoId: string;
  transform: SlideTransform;
}

export const DEFAULT_SLIDE_TRANSFORM: SlideTransform = { offsetX: 0, offsetY: 0, scale: 1 };
export const SLIDE_ZOOM_MAX = 3;

/** Clamps the transform so the photo always covers the canvas (no black edge). */
export function clampSlideTransform(
  t: SlideTransform,
  img: { width: number; height: number },
  canvas: { width: number; height: number },
): SlideTransform {
  const scale = Math.min(SLIDE_ZOOM_MAX, Math.max(1, t.scale || 1));
  const cover = Math.max(canvas.width / img.width, canvas.height / img.height);
  const maxX = Math.max(0, (img.width * cover * scale - canvas.width) / 2);
  const maxY = Math.max(0, (img.height * cover * scale - canvas.height) / 2);
  return {
    scale,
    offsetX: Math.min(maxX, Math.max(-maxX, t.offsetX || 0)),
    offsetY: Math.min(maxY, Math.max(-maxY, t.offsetY || 0)),
  };
}

/**
 * Where the photo sits inside the canvas, in % of the canvas — for an <img>
 * absolutely positioned inside a box with the canvas proportion. Same math as
 * renderPhotoIntoSlot, so the thumbnail is what gets published.
 */
export function slideImageBox(
  t: SlideTransform,
  img: { width: number; height: number },
  canvas: { width: number; height: number },
): { left: string; top: string; width: string; height: string } {
  const c = clampSlideTransform(t, img, canvas);
  const s = Math.max(canvas.width / img.width, canvas.height / img.height) * c.scale;
  const w = img.width * s;
  const h = img.height * s;
  const left = (canvas.width - w) / 2 + c.offsetX;
  const top = (canvas.height - h) / 2 + c.offsetY;
  return {
    left: `${(left / canvas.width) * 100}%`,
    top: `${(top / canvas.height) * 100}%`,
    width: `${(w / canvas.width) * 100}%`,
    height: `${(h / canvas.height) * 100}%`,
  };
}
