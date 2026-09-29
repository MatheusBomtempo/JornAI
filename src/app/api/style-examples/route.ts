import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { styleExampleSchema } from "@/lib/validation";
import { created, ok, route } from "@/lib/http";

// GET /style-examples — real examples from the newspaper, used by the AI as a reference
export const GET = route(async () => {
  const user = await requireCompanyUser();
  const examples = await prisma.styleExample.findMany({
    where: { companyId: user.companyId },
    orderBy: { orderIndex: "asc" },
  });
  return ok({ examples });
});

// POST /style-examples — qualquer papel autenticado adiciona um exemplo
export const POST = route(async (req: NextRequest) => {
  const user = await requireCompanyUser();
  const data = styleExampleSchema.parse(await req.json());

  const count = await prisma.styleExample.count({ where: { companyId: user.companyId } });
  const example = await prisma.styleExample.create({
    data: {
      companyId: user.companyId,
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
      caption: data.caption ?? null,
      orderIndex: data.orderIndex ?? count,
      createdBy: user.id,
    },
  });
  return created({ example });
});
