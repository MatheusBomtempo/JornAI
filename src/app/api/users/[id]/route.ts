import { type NextRequest } from "next/server";
import { requireCompanyUser, hashPassword, setSessionCookie } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { updateUserSchema } from "@/lib/validation";
import { forbidden, notFound, ok, route } from "@/lib/http";
import type { Prisma } from "@prisma/client";

// PATCH /users/:id — manager/admin update role/status/password. A manager
// cannot promote anyone to admin — only admin touches admin: otherwise a
// manager could set an admin's password and sign in as them. Nobody can
// deactivate or demote themselves (the company could end up with no admin).
export const PATCH = route(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireCompanyUser();
    requireRole(actor, "manager", "admin");
    const { id } = await ctx.params;
    const data = updateUserSchema.parse(await req.json());

    if (actor.role === "manager" && data.role === "admin") {
      throw forbidden("A manager cannot promote anyone to admin.");
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { companyId: true, role: true },
    });
    if (!target || target.companyId !== actor.companyId) {
      throw notFound("User not found.");
    }
    if (actor.role === "manager" && target.role === "admin") {
      throw forbidden("A manager cannot change an admin's account.");
    }
    if (
      actor.id === id &&
      (data.active === false || (data.role !== undefined && data.role !== actor.role))
    ) {
      throw forbidden("You cannot deactivate or change the role of your own account.");
    }

    const update: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.role !== undefined) update.role = data.role;
    if (data.active !== undefined) update.active = data.active;
    if (data.password !== undefined) {
      update.passwordHash = await hashPassword(data.password);
      // Signs out every session of that user (see getCurrentUser).
      update.sessionVersion = { increment: 1 };
    }

    const updated = await prisma.user.update({ where: { id }, data: update });
    // Changed their own password here: keep this device signed in.
    if (data.password !== undefined && actor.id === id) await setSessionCookie(updated);

    const { name, email, role, active } = updated;
    return ok({ user: { id, name, email, role, active } });
  },
);
