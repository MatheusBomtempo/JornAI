import { type NextRequest } from "next/server";
import { requireUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validation";
import { ok, route } from "@/lib/http";

/**
 * POST /auth/change-password — the logged-in user changes their own password
 * (e.g. after signing in with the temporary password "successNNNN"). It zeroes
 * passwordResetAt: that is what makes the change suggestion vanish from the app.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { password } = changePasswordSchema.parse(await req.json());

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), passwordResetAt: null },
  });

  return ok({ ok: true });
});
