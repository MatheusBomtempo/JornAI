import "server-only";
import { prisma } from "../db";
import { deleteObjectByUrl } from "../storage";

const PUBLISHED_TTL_DAYS = 2;
const PENDING_TTL_DAYS = 3; // in_review | failed

/**
 * What to fetch from each post before deleting it — every file it has in
 * storage. The only place that defines this (retention, manual delete and the
 * admin reset all use this constant), so nobody forgets a file type: the
 * video preview frame used to be left orphaned on R2 before it was here.
 */
export const PURGE_SELECT = {
  id: true,
  photos: { select: { storageUrl: true } },
  videos: { select: { storageUrl: true, previewFrameUrl: true } },
  versions: { select: { renderedArtUrl: true, renderedVideoUrl: true, renderedSlideUrls: true } },
} as const;

type PurgeCandidate = {
  id: string;
  photos: { storageUrl: string }[];
  videos: { storageUrl: string; previewFrameUrl: string | null }[];
  versions: {
    renderedArtUrl: string | null;
    renderedVideoUrl: string | null;
    renderedSlideUrls: string[];
  }[];
};

/**
 * Deletes the storage (photos + rendered art) of the given posts and only then
 * the database rows (via purge_posts, with an audit log — see
 * prisma/migrations/..._purge_posts_function). Shared by the automatic cleanup
 * (cleanupExpiredPosts) and the admin's manual delete (deletePostNow, in
 * services/posts.ts) — same guarantee in both: no orphaned file is ever left
 * on R2 and no row is left without an audit log.
 */
export async function purgePostsWithMedia(posts: PurgeCandidate[]): Promise<void> {
  if (posts.length === 0) return;

  const urls = new Set<string>();
  for (const post of posts) {
    for (const photo of post.photos) urls.add(photo.storageUrl);
    for (const video of post.videos) {
      urls.add(video.storageUrl);
      if (video.previewFrameUrl) urls.add(video.previewFrameUrl);
    }
    for (const version of post.versions) {
      if (version.renderedArtUrl) urls.add(version.renderedArtUrl);
      if (version.renderedVideoUrl) urls.add(version.renderedVideoUrl);
      for (const url of version.renderedSlideUrls) urls.add(url);
    }
  }

  // Delete the storage first; if a URL fails, log and carry on — the
  // retention policy (the data must leave the database on time) matters more
  // than a rare orphaned object on R2, which weighs nothing in usage (see the
  // discussion about storage cost).
  await Promise.all(
    [...urls].map((url) =>
      deleteObjectByUrl(url).catch((err) =>
        console.error(`[JornAI] Failed to delete from storage (${url}):`, err),
      ),
    ),
  );

  const ids = posts.map((p) => p.id);
  await prisma.$executeRaw`SELECT purge_posts(${ids}::uuid[]);`;
}

/**
 * Cleanup of expired posts (published more than 2 days ago, or in review/
 * failed more than 3 days ago). "Delete" never touches Instagram — it only
 * removes from our database + storage.
 *
 * The expiry rule lives here (not in SQL) on purpose: only the app can delete
 * the real file on R2, so the app has to decide "who expired" before deleting
 * storage, and use the SAME set of ids afterwards to delete the database rows
 * — hence purge_posts(ids) receiving ready-made ids instead of recomputing the
 * rule.
 */
export async function cleanupExpiredPosts(): Promise<{ purged: number }> {
  const publishedCutoff = new Date(Date.now() - PUBLISHED_TTL_DAYS * 86_400_000);
  const pendingCutoff = new Date(Date.now() - PENDING_TTL_DAYS * 86_400_000);

  const expired = await prisma.post.findMany({
    where: {
      OR: [
        { status: "published", updatedAt: { lt: publishedCutoff } },
        { status: { in: ["in_review", "failed"] }, updatedAt: { lt: pendingCutoff } },
      ],
    },
    select: PURGE_SELECT,
  });
  if (expired.length === 0) return { purged: 0 };

  await purgePostsWithMedia(expired);
  return { purged: expired.length };
}

const THROTTLE_MS = 60 * 60 * 1000; // at most once an hour
let lastRunAt = 0;

/**
 * Opportunistic alarm clock: runs the cleanup when someone loads the feed,
 * with an in-memory throttle — only a backstop for local dev (no cron). In
 * prod (Vercel), what drives it is Vercel Cron hitting /api/cron/cleanup once
 * a day (see vercel.json); this function stays harmless there because the
 * in-memory throttle resets on every cold start, but cleanupExpiredPosts() is
 * cheap when nothing has expired.
 */
export async function maybeCleanupExpiredPosts(): Promise<void> {
  const now = Date.now();
  if (now - lastRunAt < THROTTLE_MS) return;
  lastRunAt = now;
  try {
    await cleanupExpiredPosts();
  } catch (err) {
    console.error("[JornAI] Failed to run cleanupExpiredPosts:", err);
  }
}
