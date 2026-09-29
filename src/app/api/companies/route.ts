import { type NextRequest } from "next/server";
import { requireUser, requireCompanyUser, setSessionCookie } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { createCompanySchema, updateCompanySchema } from "@/lib/validation";
import { createCompanyForUser, getCompany, updateCompany } from "@/lib/services/company";
import { created, ok, route } from "@/lib/http";

// GET /companies — data of the logged-in user's company (Admin → Company).
export const GET = route(async () => {
  const user = await requireCompanyUser();
  const company = await getCompany(user.companyId);
  return ok({ company });
});

// POST /companies — onboarding: an admin with no company registers theirs.
// Re-issues the session cookie with the new companyId, otherwise the middleware
// sends the person back to onboarding on the next request (the old JWT did not
// have this claim).
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  requireRole(user, "admin");
  const input = createCompanySchema.parse(await req.json());

  const { company, user: updatedUser } = await createCompanyForUser(user, input);
  await setSessionCookie(updatedUser);

  return created({ company });
});

// PATCH /companies — admin edits the name/logo/handle of their own company.
export const PATCH = route(async (req: NextRequest) => {
  const user = await requireCompanyUser();
  requireRole(user, "admin");
  const input = updateCompanySchema.parse(await req.json());
  const company = await updateCompany(user.companyId, input);
  return ok({ company });
});
