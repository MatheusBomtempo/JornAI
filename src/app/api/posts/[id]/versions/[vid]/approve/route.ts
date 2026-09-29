import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { approveAndPublish } from "@/lib/services/posts";
import { ok, route } from "@/lib/http";

// Video: Instagram processes the container asynchronously (status_code
// polling) before publishing — it can take a lot longer than the default.
export const maxDuration = 290;

// POST /posts/:id/versions/:vid/approve — aprova e publica no Instagram
export const POST = route(
  async (
    _req: NextRequest,
    ctx: { params: Promise<{ id: string; vid: string }> },
  ) => {
    const user = await requireCompanyUser();
    const { id, vid } = await ctx.params;
    const post = await approveAndPublish(user, id, vid);
    return ok({ post });
  },
);
