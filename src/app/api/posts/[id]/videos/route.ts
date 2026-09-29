import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { addVideoSchema } from "@/lib/validation";
import { addVideoToPost } from "@/lib/services/posts";
import { created, route } from "@/lib/http";

// Extracts the middle frame (ffmpeg) before answering — see addVideoToPost.
export const maxDuration = 120;

// POST /posts/:id/videos — attaches a video to a post (equivalent to /photos,
// for the video post instead of photo).
export const POST = route(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompanyUser();
    const { id } = await ctx.params;
    const input = addVideoSchema.parse(await req.json());
    const { video, previewError, post } = await addVideoToPost(user, id, input);
    return created({ video, previewError, post });
  },
);
