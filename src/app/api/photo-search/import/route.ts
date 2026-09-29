import { type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { assertPexelsDownloadUrl } from "@/lib/services/photo-search";
import { importPexelsPhotoSchema } from "@/lib/validation";
import { compressSourcePhoto } from "@/lib/media";
import { putObject } from "@/lib/storage";
import { badRequest, created, route } from "@/lib/http";

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // the Pexels "original" can be big; we recompress afterwards

// POST /photo-search/import — downloads, on the server side, the photo chosen
// in the Pexels picker and returns the URL already in our storage (same shape
// as /api/upload), to attach to the post with the usual POST /posts/:id/photos.
// It is not a generic proxy: assertPexelsDownloadUrl locks the host to
// *.pexels.com (the URL comes from the client, so this prevents SSRF).
export const POST = route(async (req: NextRequest) => {
  await requireUser();
  const { downloadUrl } = importPexelsPhotoSchema.parse(await req.json());
  const url = assertPexelsDownloadUrl(downloadUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    const why = (err as Error).name === "AbortError" ? "tempo esgotado" : (err as Error).message;
    throw badRequest(`Could not download the photo from Pexels (${why}).`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw badRequest(`Pexels refused the download (HTTP ${res.status}).`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw badRequest("The Pexels link did not return an image.");
  }

  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.byteLength > MAX_DOWNLOAD_BYTES) {
    throw badRequest("The Pexels image is larger than expected.");
  }

  const buffer = await compressSourcePhoto(raw);
  const key = `sources/${new Date().getFullYear()}/${randomUUID()}.jpg`;
  const { url: storedUrl } = await putObject(key, buffer, "image/jpeg");
  return created({ url: storedUrl, key });
});
