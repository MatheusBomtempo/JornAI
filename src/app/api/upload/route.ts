import { type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { putObject } from "@/lib/storage";
import { compressSourcePhoto, videoExtension } from "@/lib/media";
import { badRequest, created, route } from "@/lib/http";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB, before compressing
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB — teto de body do Vercel Functions
const ALLOWED_VIDEO = new Set(["video/mp4", "video/quicktime", "video/webm"]);

// A video upload can be slow on a weak connection; the final render is done
// separately (see /api/posts/[id]/video), this endpoint only receives the file.
export const maxDuration = 120;

/**
 * Media upload to the configured storage. Returns the public URL used later in
 * POST /posts, /art-templates, etc. Uses, handled differently:
 *  - "photo" (default): source photo, only used internally (the JornAI
 *    workspace/feed and as input to the render — never published directly).
 *    Heavily recompressed: cuts storage cost without affecting the art that
 *    goes to Instagram.
 *  - "overlay": template PNG (it has transparency, it is the design itself) —
 *    stored as it came, without recompressing/flattening the alpha channel.
 *  - "video": source video for the video post — stored as it came (the final
 *    render with the animated text happens separately, via ffmpeg).
 */
export const POST = route(async (req: NextRequest) => {
  await requireUser();

  const form = await req.formData();
  const file = form.get("file");
  const kindRaw = form.get("kind");
  const kind = kindRaw === "overlay" ? "overlay" : kindRaw === "video" ? "video" : "photo";
  if (!(file instanceof File)) throw badRequest("Missing 'file' field.");

  if (kind === "video") {
    if (!ALLOWED_VIDEO.has(file.type)) {
      throw badRequest("Unsupported format (use MP4, MOV or WebM).");
    }
    if (file.size > MAX_VIDEO_BYTES) throw badRequest("File larger than 100 MB.");
    const raw = Buffer.from(await file.arrayBuffer());
    const key = `sources/${new Date().getFullYear()}/${randomUUID()}.${videoExtension(file.type)}`;
    const { url } = await putObject(key, raw, file.type);
    return created({ url, key });
  }

  if (!ALLOWED.has(file.type)) {
    throw badRequest("Unsupported format (use JPEG, PNG or WebP).");
  }
  if (file.size > MAX_BYTES) throw badRequest("File larger than 15 MB.");

  const raw = Buffer.from(await file.arrayBuffer());

  if (kind === "overlay") {
    const ext = file.type.split("/")[1] ?? "png";
    const key = `overlays/${new Date().getFullYear()}/${randomUUID()}.${ext}`;
    const { url } = await putObject(key, raw, file.type);
    return created({ url, key });
  }

  const buffer = await compressSourcePhoto(raw);

  const key = `sources/${new Date().getFullYear()}/${randomUUID()}.jpg`;
  const { url } = await putObject(key, buffer, "image/jpeg");
  return created({ url, key });
});
