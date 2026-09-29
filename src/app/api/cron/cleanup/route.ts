import { type NextRequest } from "next/server";
import { cleanupExpiredPosts } from "@/lib/services/retention";
import { env } from "@/lib/env";
import { ok, route, unauthorized } from "@/lib/http";

/**
 * Fired once a day by Vercel Cron (see vercel.json). Authenticated by
 * CRON_SECRET: Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
 * on cron jobs — without this variable configured, anyone on the internet
 * could hit this and force the cleanup at the wrong time.
 */
export const GET = route(async (req: NextRequest) => {
  if (env.cronSecret && req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    throw unauthorized();
  }
  const result = await cleanupExpiredPosts();
  return ok(result);
});
