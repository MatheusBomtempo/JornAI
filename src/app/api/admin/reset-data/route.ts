import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { resetDataSchema } from "@/lib/validation";
import { resetCompanyData } from "@/lib/services/data-reset";
import { ok, route } from "@/lib/http";

// Deletes file by file in storage before the database rows — with many
// posts/videos it can take longer than the default.
export const maxDuration = 120;

// POST /admin/reset-data — admin only, only the data of their own company, and
// only with the confirmation word in the body (see resetDataSchema): an
// accidental call to the API deletes nothing. Users and configuration stay
// intact (see services/data-reset.ts).
export const POST = route(async (req: NextRequest) => {
  const user = await requireCompanyUser();
  requireRole(user, "admin");
  const { scope } = resetDataSchema.parse(await req.json());
  const result = await resetCompanyData(user.companyId, scope);
  return ok(result);
});
