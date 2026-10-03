import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { approveSchema } from "@/lib/validation";
import { approveAndPublish } from "@/lib/services/posts";
import { ok, route } from "@/lib/http";

// Video: Instagram processes the container asynchronously (status_code
// polling) before publishing — it can take a lot longer than the default.
export const maxDuration = 290;

// POST /posts/:id/versions/:vid/approve — aprova e publica no Instagram
// Body (optional): { shareToStory?: boolean } — also posts it to the story.
export const POST = route(
  async (
    req: NextRequest,
    ctx: { params: Promise<{ id: string; vid: string }> },
  ) => {
    const user = await requireCompanyUser();
    const { id, vid } = await ctx.params;
    // The body is optional: older API clients call this with no body at all.
    const opts = approveSchema.parse(await req.json().catch(() => ({})));
    const post = await approveAndPublish(user, id, vid, opts);
    return ok({ post });
  },
);
