import "server-only";
import sharp from "sharp";
import { putObject } from "../storage";
import { renderTextToSvg } from "./text";
import {
  photoSlotSchema,
  textSlotSchema,
  photoTransformSchema,
  textOffsetSchema,
  type PhotoSlot,
  type PhotoTransform,
  type TextSlot,
} from "./slots";

/**
 * Final render of the art on the server (Sharp), from the SAME parameters
 * saved by the editor — not from the browser canvas. It guarantees quality and
 * reproducibility (SPEC.md).
 *
 * Composition, from bottom to top:
 *   1. photo (with pan/zoom, cropped to the slot)
 *   2. template overlay (brand PNG, transparent where the photo shows)
 *   3. title  (Poppins, vectorized)
 *   4. subtitle (Poppins, vectorized)
 */

export interface RenderArtParams {
  canvasWidth: number;
  canvasHeight: number;
  overlayAssetUrl: string;
  photoUrl: string;
  photoSlot: unknown;
  titleSlot: unknown;
  subtitleSlot?: unknown;
  transform: unknown;
  title: string;
  subtitle?: string;
  /** Optional offset of the title/subtitle — the template stays intact. */
  titleOffset?: unknown;
  subtitleOffset?: unknown;
}

/**
 * Applies the offset (if any) keeping the slot's width/height intact. Clamps
 * inside the canvas limits — without this, a large enough offset pushes the
 * text box off the art and the text gets cut at the edge (the line-wrap width
 * stays that of the original slot, so a box shifted beyond the canvas never
 * fit back).
 */
function offsetSlot(
  slot: TextSlot,
  rawOffset: unknown,
  canvasWidth: number,
  canvasHeight: number,
): TextSlot {
  const { offsetX, offsetY } = textOffsetSchema.parse(rawOffset ?? {});
  if (!offsetX && !offsetY) return slot;
  const maxX = Math.max(0, canvasWidth - slot.width);
  const maxY = Math.max(0, canvasHeight - slot.height);
  const x = Math.min(Math.max(slot.x + offsetX, 0), maxX);
  const y = Math.min(Math.max(slot.y + offsetY, 0), maxY);
  return { ...slot, x, y };
}

export async function renderArt(params: RenderArtParams): Promise<Buffer> {
  const photoSlot = photoSlotSchema.parse(params.photoSlot);
  const titleSlot = textSlotSchema.parse(params.titleSlot);
  const transform = photoTransformSchema.parse(params.transform ?? {});
  const subtitleSlot = params.subtitleSlot
    ? textSlotSchema.parse(params.subtitleSlot)
    : null;

  const [photoBuf, overlayBuf] = await Promise.all([
    fetchBuffer(params.photoUrl),
    fetchBuffer(params.overlayAssetUrl),
  ]);

  const layers: sharp.OverlayOptions[] = [];

  // 1) Photo positioned inside the slot (with pan/zoom), cropped to the slot.
  const slotImg = await renderPhotoIntoSlot(photoBuf, photoSlot, transform);
  if (slotImg) {
    layers.push({
      input: slotImg,
      left: Math.round(photoSlot.x),
      top: Math.round(photoSlot.y),
    });
  }

  // 2) Overlay do template.
  const overlayResized = await sharp(overlayBuf)
    .resize(params.canvasWidth, params.canvasHeight, { fit: "fill" })
    .png()
    .toBuffer();
  layers.push({ input: overlayResized, left: 0, top: 0 });

  // 3 + 4) Title and subtitle in vectorized Poppins, in a single SVG.
  // The offset (if the reporter moved the text in this version) only shifts
  // the position — width, font and line wrapping stay the template's.
  const title = await renderTextToSvg(
    params.title ?? "",
    offsetSlot(titleSlot, params.titleOffset, params.canvasWidth, params.canvasHeight),
  );
  const subtitle = subtitleSlot
    ? await renderTextToSvg(
        params.subtitle ?? "",
        offsetSlot(subtitleSlot, params.subtitleOffset, params.canvasWidth, params.canvasHeight),
      )
    : { svg: "", height: 0, lines: 0 };

  if (title.svg || subtitle.svg) {
    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${params.canvasWidth}" height="${params.canvasHeight}">
${title.svg}
${subtitle.svg}
</svg>`;
    layers.push({ input: Buffer.from(textSvg), left: 0, top: 0 });
  }

  return sharp({
    create: {
      width: params.canvasWidth,
      height: params.canvasHeight,
      channels: 4,
      background: { r: 12, g: 14, b: 18, alpha: 1 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

/** Render + upload to storage, returning the public URL. */
export async function renderAndStore(
  params: RenderArtParams,
  key: string,
): Promise<string> {
  const buf = await renderArt(params);
  const { url } = await putObject(key, buf, "image/png");
  return url;
}

/**
 * Carousel photo after the cover: only the photo, no template and no text —
 * the whole canvas is the photo slot, with the same pan/zoom units the editor
 * (SlideFramer) uses, so the result matches the thumbnail. JPEG: the format
 * Instagram documents for carousel items, and much lighter than PNG for a
 * full-bleed photo.
 */
export async function renderSlideAndStore(
  params: { photoUrl: string; canvasWidth: number; canvasHeight: number; transform: unknown },
  key: string,
): Promise<string> {
  const transform = photoTransformSchema.parse(params.transform ?? {});
  const photoBuf = await fetchBuffer(params.photoUrl);
  const slot = { x: 0, y: 0, width: params.canvasWidth, height: params.canvasHeight };
  const slotImg = await renderPhotoIntoSlot(photoBuf, slot, transform);

  const buf = await sharp({
    create: {
      width: params.canvasWidth,
      height: params.canvasHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(slotImg ? [{ input: slotImg, left: 0, top: 0 }] : [])
    .jpeg({ quality: 90 })
    .toBuffer();
  const { url } = await putObject(key, buf, "image/jpeg");
  return url;
}

// ── Internos ─────────────────────────────────────────────────

async function renderPhotoIntoSlot(
  photoBuf: Buffer,
  slot: PhotoSlot,
  t: PhotoTransform,
): Promise<Buffer | null> {
  const meta = await sharp(photoBuf).metadata();
  const iw = meta.width ?? slot.width;
  const ih = meta.height ?? slot.height;

  // scale=1 => "cover" do slot; scale ajusta o zoom por cima disso.
  const coverScale = Math.max(slot.width / iw, slot.height / ih);
  const finalScale = coverScale * t.scale;
  const dispW = Math.max(1, Math.round(iw * finalScale));
  const dispH = Math.max(1, Math.round(ih * finalScale));

  const resized = await sharp(photoBuf).resize(dispW, dispH).toBuffer();

  const left = Math.round((slot.width - dispW) / 2 + t.offsetX);
  const top = Math.round((slot.height - dispH) / 2 + t.offsetY);

  const ex = Math.max(0, -left);
  const ey = Math.max(0, -top);
  const ew = Math.min(dispW - ex, slot.width - Math.max(0, left));
  const eh = Math.min(dispH - ey, slot.height - Math.max(0, top));
  if (ew <= 0 || eh <= 0) return null;

  const region = await sharp(resized)
    .extract({ left: ex, top: ey, width: ew, height: eh })
    .toBuffer();

  return sharp({
    create: {
      width: Math.round(slot.width),
      height: Math.round(slot.height),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: region, left: Math.max(0, left), top: Math.max(0, top) },
    ])
    .png()
    .toBuffer();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download resource (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
