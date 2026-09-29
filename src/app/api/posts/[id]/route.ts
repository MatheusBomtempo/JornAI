import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { getPostDetail, deletePostNow } from "@/lib/services/posts";
import { notFound, ok, route } from "@/lib/http";

// GET /posts/:id — detail with versions, decisions and publications
export const GET = route(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompanyUser();
    const { id } = await ctx.params;
    const post = await getPostDetail(id);
    if (!post || post.companyId !== user.companyId) throw notFound("Post not found.");
    return ok({ post });
  },
);

// DELETE /posts/:id — deletes the story right now, regardless of status
export const DELETE = route(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompanyUser();
    const { id } = await ctx.params;
    await deletePostNow(user, id);
    return ok({ deleted: true });
  },
);
