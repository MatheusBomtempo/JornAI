import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { getAiBalance } from "@/lib/services/ai-balance";
import { ok, route } from "@/lib/http";

// GET /ai-balance — credit balance of the AI provider (admin only).
// 60s cache on the server; ?fresh=1 forces a new lookup ("Refresh" button).
export const GET = route(async (req: NextRequest) => {
  const user = await requireCompanyUser();
  requireRole(user, "admin");
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  return ok(await getAiBalance({ fresh }));
});
