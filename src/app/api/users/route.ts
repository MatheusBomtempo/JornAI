import { type NextRequest } from "next/server";
import { requireCompanyUser, generateTempPassword, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { sendCredentialsEmail } from "@/lib/email";
import { prisma } from "@/lib/db";
import { createUserSchema } from "@/lib/validation";
import { conflict, created, forbidden, ok, route } from "@/lib/http";

// GET /users — manager/admin list users
export const GET = route(async () => {
  const user = await requireCompanyUser();
  requireRole(user, "manager", "admin");
  const users = await prisma.user.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      passwordResetAt: true,
    },
  });
  return ok({ users });
});

// POST /users — manager/admin create a user. A manager only creates
// manager/staff — only admin promotes admin (explicit request from the product
// owner). The temporary password ("successNN") is always generated on the
// server and sent by email (automatic login) — whoever creates the account
// never types or sees the password. The person swaps it for their own after
// signing in (see /api/auth/change-password).
export const POST = route(async (req: NextRequest) => {
  const actor = await requireCompanyUser();
  requireRole(actor, "manager", "admin");
  const data = createUserSchema.parse(await req.json());

  if (actor.role === "manager" && data.role === "admin") {
    throw forbidden("A manager can only create manager or reporter accounts.");
  }

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw conflict("A user with this email already exists.");

  const tempPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      companyId: actor.companyId,
      passwordHash: await hashPassword(tempPassword),
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  // The account already exists even if the email fails (e.g. a Gmail sending
  // error) — it makes no sense to block the creation because of that. Whoever
  // created it uses "Resend login" after fixing the problem.
  let emailSent = true;
  let emailError: string | undefined;
  try {
    await sendCredentialsEmail({ to: user.email, name: user.name, password: tempPassword });
    await prisma.user.update({ where: { id: user.id }, data: { passwordResetAt: new Date() } });
  } catch (err) {
    emailSent = false;
    emailError = (err as Error).message;
  }

  return created({ user, emailSent, emailError });
});
