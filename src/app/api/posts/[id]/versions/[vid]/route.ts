import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { editVersionSchema } from "@/lib/validation";
import { editVersionManually } from "@/lib/services/posts";
import { ok, route } from "@/lib/http";

// May trigger a video re-render (ffmpeg) + auto-publish — see approve/route.ts.
export const maxDuration = 290;

// PATCH /posts/:id/versions/:vid — manual text edit (creates a new version)
export const PATCH = route(
  async (
    req: NextRequest,
    ctx: { params: Promise<{ id: string; vid: string }> },
  ) => {
    const user = await requireCompanyUser();
    const { id, vid } = await ctx.params;
    const input = editVersionSchema.parse(await req.json());
    const result = await editVersionManually(user, id, vid, input);
    return ok(result);
  },
);
