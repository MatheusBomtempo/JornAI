import "server-only";
import { prisma } from "../db";
import { conflict } from "../http";
import { normalizeHandle } from "../domain";
import type { User } from "@prisma/client";

interface CreateCompanyInput {
  name: string;
  logoUrl?: string;
  instagramHandle?: string;
}

/**
 * Onboarding: the freshly logged-in admin (no company yet) registers the
 * company and becomes its first member. A user can only do this once —
 * afterwards, the admin is the one who invites the rest of the team (see
 * /api/users).
 */
export async function createCompanyForUser(user: User, input: CreateCompanyInput) {
  if (user.companyId) throw conflict("You already have a company registered.");

  const company = await prisma.company.create({
    data: {
      name: input.name,
      logoUrl: input.logoUrl ?? null,
      instagramHandle: input.instagramHandle ? normalizeHandle(input.instagramHandle) : null,
    },
  });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { companyId: company.id },
  });

  return { company, user: updatedUser };
}

interface UpdateCompanyInput {
  name?: string;
  logoUrl?: string | null;
  instagramHandle?: string | null;
  brandColorDark?: string | null;
  brandColorLight?: string | null;
  brandColorAccent?: string | null;
}

/** Admin adjusts name/logo/handle/colors after onboarding (see Admin → Company). */
export function updateCompany(companyId: string, input: UpdateCompanyInput) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      name: input.name,
      logoUrl: input.logoUrl,
      instagramHandle:
        input.instagramHandle === undefined
          ? undefined
          : input.instagramHandle
            ? normalizeHandle(input.instagramHandle)
            : null,
      brandColorDark: input.brandColorDark,
      brandColorLight: input.brandColorLight,
      brandColorAccent: input.brandColorAccent,
    },
  });
}

export function getCompany(companyId: string) {
  return prisma.company.findUnique({ where: { id: companyId } });
}
