import "server-only";
import { prisma } from "../db";

/** 1 row per company — created with the defaults on the first read/write. */
export function getAppSettings(companyId: string) {
  return prisma.appSettings.upsert({
    where: { companyId },
    update: {},
    create: { companyId },
  });
}

export function updateAppSettings(companyId: string, input: { reviewRequired: boolean }) {
  return prisma.appSettings.upsert({
    where: { companyId },
    update: input,
    create: { companyId, ...input },
  });
}
