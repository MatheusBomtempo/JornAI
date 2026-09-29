import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { saveVideoSchema } from "@/lib/validation";
import { saveVideoAndRender } from "@/lib/services/posts";
import { ok, route } from "@/lib/http";

// ffmpeg re-encodes the whole video — much slower than the image render
// (Sharp). It may also auto-publish (review turned off), which adds the time
// spent waiting for Instagram to process the video.
export const maxDuration = 290;

// POST /posts/:id/video — saves the chosen video + title and triggers the final
// render (animated title card, via ffmpeg) — equivalent to /art, but for video
// posts instead of photo.
export const POST = route(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompanyUser();
    const { id } = await ctx.params;
    const input = saveVideoSchema.parse(await req.json());
    const post = await saveVideoAndRender(user, id, input);
    return ok({ post });
  },
);
