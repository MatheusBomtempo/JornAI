import { type NextRequest } from "next/server";
import { requireCompanyUser, generateTempPassword, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { sendCredentialsEmail } from "@/lib/email";
import { prisma } from "@/lib/db";
import { badRequest, notFound, ok, route } from "@/lib/http";

/**
 * POST /users/:id/reset-password — manager/admin generate a new password for
 * the user and send it by email (Gmail). Nobody sees the password on screen —
 * not even whoever triggered the reset: it only exists in memory for the time
 * it takes to generate the hash and build the email, and is never stored in
 * plain text nor returned in the response.
 */
export const POST = route(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireCompanyUser();
    requireRole(actor, "manager", "admin");
    const { id } = await ctx.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, companyId: true },
    });
    if (!target || target.companyId !== actor.companyId) {
      throw notFound("User not found.");
    }

    const tempPassword = generateTempPassword();
    const passwordResetAt = new Date();

    try {
      await sendCredentialsEmail({
        to: target.email,
        name: target.name,
        password: tempPassword,
      });
    } catch (err) {
      // Real reason on screen for whoever triggered it (always admin/manager, so
      // there is no risk of leaking an internal detail to someone without
      // permission) — without it the cause could only be known by reading the
      // server log.
      throw badRequest(`Failed to send the email: ${(err as Error).message}`);
    }

    // Only updates the hash AFTER the email goes out — if the send fails, the old
    // password keeps working (avoids changing access without the person knowing the new one).
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(tempPassword),
        passwordResetAt,
      },
    });

    return ok({ sentAt: passwordResetAt.toISOString() });
  },
);
