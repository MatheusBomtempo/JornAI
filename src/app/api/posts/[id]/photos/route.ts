import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { addPhotoSchema } from "@/lib/validation";
import { addPhotoToPost } from "@/lib/services/posts";
import { created, route } from "@/lib/http";

// POST /posts/:id/photos — attaches an extra photo to an already-created post
// (the reporter decided on the photo after generating the text: found a better
// one, downloaded from Google Images or from a free library based on a suggestion).
export const POST = route(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompanyUser();
    const { id } = await ctx.params;
    const input = addPhotoSchema.parse(await req.json());
    const { photo, post } = await addPhotoToPost(user, id, input);
    return created({ photo, post });
  },
);
