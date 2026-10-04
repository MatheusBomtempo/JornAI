import { type NextRequest } from "next/server";
import { requireUser, hashPassword, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validation";
import { ok, route } from "@/lib/http";

/**
 * POST /auth/change-password — the logged-in user changes their own password
 * (e.g. after signing in with the temporary password "successNNNN"). It zeroes
 * passwordResetAt: that is what makes the change suggestion vanish from the app.
 * Bumping sessionVersion signs out every other device; this one gets a fresh
 * cookie with the new version and stays signed in.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { password } = changePasswordSchema.parse(await req.json());

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordResetAt: null,
      sessionVersion: { increment: 1 },
    },
  });
  await setSessionCookie(updated);

  return ok({ ok: true });
});
