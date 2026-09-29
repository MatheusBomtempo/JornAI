import { type NextRequest } from "next/server";
import { requireCompanyUser, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { updateUserSchema } from "@/lib/validation";
import { forbidden, notFound, ok, route } from "@/lib/http";
import type { Prisma } from "@prisma/client";

// PATCH /users/:id — manager/admin update role/status/password. A manager
// cannot promote anyone to admin — only admin touches admin.
export const PATCH = route(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireCompanyUser();
    requireRole(actor, "manager", "admin");
    const { id } = await ctx.params;
    const data = updateUserSchema.parse(await req.json());

    if (actor.role === "manager" && data.role === "admin") {
      throw forbidden("A manager cannot promote anyone to admin.");
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { companyId: true } });
    if (!target || target.companyId !== actor.companyId) {
      throw notFound("User not found.");
    }

    const update: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.role !== undefined) update.role = data.role;
    if (data.active !== undefined) update.active = data.active;
    if (data.password !== undefined) {
      update.passwordHash = await hashPassword(data.password);
    }

    const user = await prisma.user.update({
      where: { id },
      data: update,
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    return ok({ user });
  },
);
