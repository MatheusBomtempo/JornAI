import { type NextRequest } from "next/server";
import { requireCompanyUser, generateApiKey } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createApiKeySchema } from "@/lib/validation";
import { created, ok, route } from "@/lib/http";

// GET /api-keys — admin lists keys (without exposing the value)
export const GET = route(async () => {
  const user = await requireCompanyUser();
  requireRole(user, "admin");
  const keys = await prisma.apiKey.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      scopes: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return ok({ keys });
});

// POST /api-keys — admin creates a key; the plain-text value is returned ONCE
export const POST = route(async (req: NextRequest) => {
  const user = await requireCompanyUser();
  requireRole(user, "admin");
  const data = createApiKeySchema.parse(await req.json());

  const { plain, hash } = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      companyId: user.companyId,
      name: data.name,
      scopes: data.scopes,
      keyHash: hash,
      createdBy: user.id,
    },
    select: { id: true, name: true, scopes: true, createdAt: true },
  });

  // `plain` only shows up here — it cannot be recovered afterwards.
  return created({ key: { ...key, secret: plain } });
});
