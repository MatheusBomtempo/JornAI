import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { regenerateSchema } from "@/lib/validation";
import { regeneratePost } from "@/lib/services/posts";
import { ok, route } from "@/lib/http";

// Same AI chain as POST /posts — see maxDuration there for the reason.
export const maxDuration = 60;

// POST /posts/:id/regenerate — new AI cycle (new version, same photos)
export const POST = route(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompanyUser();
    const { id } = await ctx.params;
    const body = regenerateSchema.parse(await req.json().catch(() => ({})));
    const result = await regeneratePost(user, id, body);
    return ok(result);
  },
);
