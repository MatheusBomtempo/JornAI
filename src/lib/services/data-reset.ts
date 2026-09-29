import "server-only";
import { prisma } from "../db";
import { POST_STATUS } from "../domain";
import { PURGE_SELECT, purgePostsWithMedia } from "./retention";

/**
 * Manual cleanup by the admin (Admin → Settings → Danger zone), to zero the
 * database between test rounds and free storage on R2.
 *
 * Always restricted to the COMPANY of whoever asked — it never touches data
 * from another newsroom. Posts go out through the same path as retention
 * (purgePostsWithMedia): first the files in storage (photos, videos, preview
 * frames, rendered art and videos), then the database rows.
 *
 * It never deletes: users, the company (name/logo/handle), art templates,
 * style examples, API keys and settings — that is configuration, not test
 * data, and redoing a brand template is a lot of work.
 */
export type ResetScope = "unpublished" | "all";

export interface ResetResult {
  posts: number;
  logs: number;
}

// "Not yet published" = everything that is not published. `publishing` is left
// out: it is the instant the post is going to Instagram, and deleting in the
// middle would leave the publication orphaned.
const KEEP_WHEN_UNPUBLISHED = [POST_STATUS.PUBLISHED, POST_STATUS.PUBLISHING];

export async function resetCompanyData(companyId: string, scope: ResetScope): Promise<ResetResult> {
  const posts = await prisma.post.findMany({
    where:
      scope === "unpublished"
        ? { companyId, status: { notIn: KEEP_WHEN_UNPUBLISHED } }
        : { companyId },
    select: PURGE_SELECT,
  });

  await purgePostsWithMedia(posts);

  // "Delete everything" also zeroes the history (the "automatically removed
  // publications" record and the trail the purge itself just wrote) — on
  // request: a clean base, with only the users.
  let logs = 0;
  if (scope === "all") {
    ({ count: logs } = await prisma.postAuditLog.deleteMany({ where: { companyId } }));
  }

  return { posts: posts.length, logs };
}
