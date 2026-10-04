import { type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { presignPut } from "@/lib/storage";
import { videoExtension } from "@/lib/media";
import { badRequest, ok, route } from "@/lib/http";

const ALLOWED_VIDEO = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const presignSchema = z.object({
  contentType: z.string(),
});

/**
 * POST /api/upload/presign — direct upload URL to storage (S3/R2), so the
 * browser sends the video without going through the function's body. Video is
 * the only case today: even with the app's 100 MB ceiling, the body of a
 * function on Vercel has a much lower limit, and that already broke video
 * uploads in production with a 413 before the file even reached the code (see
 * POST /api/upload). Photos keep the old flow — 15 MB fits.
 *
 * With local storage (dev) there is no HTTP endpoint to sign; it returns a null
 * uploadUrl and the caller falls back to the usual POST /api/upload.
 */
export const POST = route(async (req: NextRequest) => {
  await requireUser();

  const { contentType } = presignSchema.parse(await req.json());
  if (!ALLOWED_VIDEO.has(contentType)) {
    throw badRequest("Unsupported format (use MP4, MOV or WebM).");
  }

  const key = `sources/${new Date().getFullYear()}/${randomUUID()}.${videoExtension(contentType)}`;
  const presigned = await presignPut(key, contentType);

  return ok(presigned ?? { uploadUrl: null });
});
