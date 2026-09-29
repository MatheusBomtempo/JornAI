import "server-only";
import sharp from "sharp";

/** The final art never exceeds ~1080-1350px on a side — leaves headroom without overdoing it. */
export const PHOTO_MAX_DIMENSION = 1600;

/**
 * Recompresses a source photo to the standard used in storage (JPEG, max side
 * 1600px, no EXIF). Shared by /api/upload (manual upload) and by the Pexels
 * import (see services/photo-search.ts) — same destination, same treatment.
 */
export async function compressSourcePhoto(raw: Buffer): Promise<Buffer> {
  return sharp(raw)
    .rotate() // auto-orients by EXIF and, when (re)encoding, drops the EXIF (GPS included)
    .resize({
      width: PHOTO_MAX_DIMENSION,
      height: PHOTO_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}
