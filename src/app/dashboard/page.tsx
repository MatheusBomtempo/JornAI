import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { listPosts, listAuditLogs } from "@/lib/services/posts";
import { maybeCleanupExpiredPosts } from "@/lib/services/retention";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { DeletePostButton } from "@/components/DeletePostButton";
import { CardQuickActions } from "@/components/CardQuickActions";
import { getServerDictionary } from "@/lib/i18n/server";
import { POST_STATUS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePageUser();
  if (!user.companyId) redirect("/onboarding");

  const { locale, dict } = await getServerDictionary();
  const dateLocale = locale === "pt" ? "pt-BR" : "en-US";

  // It has to finish BEFORE reading posts/log in parallel — otherwise the log
  // read can run before the row is inserted by the cleanup itself.
  await maybeCleanupExpiredPosts();
  const [allPosts, auditLogs, { status: statusFilter }] = await Promise.all([
    listPosts(user.companyId),
    listAuditLogs(user.companyId),
    searchParams,
  ]);

  // Status chips: only statuses that actually have posts, in pipeline order.
  const statusCounts = new Map<string, number>();
  for (const p of allPosts) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
  const chips = Object.values(POST_STATUS).filter((s) => statusCounts.has(s));
  const activeFilter = statusFilter && statusCounts.has(statusFilter) ? statusFilter : null;
  const posts = activeFilter ? allPosts.filter((p) => p.status === activeFilter) : allPosts;

  return (
    <AppShell user={{ name: user.name, role: user.role, mustSetPassword: user.passwordResetAt !== null }}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dict.dashboard.title}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {allPosts.length}{" "}
            {allPosts.length === 1 ? dict.dashboard.postCountOne : dict.dashboard.postCountOther}
          </p>
        </div>
        {/* On phones the bottom bar already has a big "new story" button. */}
        <Link href="/capture" className="btn-primary hidden shrink-0 md:inline-flex">
          {dict.dashboard.newStory}
        </Link>
      </div>

      {chips.length > 1 && (
        <nav
          aria-label={dict.dashboard.filterLabel}
          className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          <FilterChip href="/dashboard" active={!activeFilter} count={allPosts.length}>
            {dict.dashboard.filterAll}
          </FilterChip>
          {chips.map((s) => (
            <FilterChip
              key={s}
              href={`/dashboard?status=${s}`}
              active={activeFilter === s}
              count={statusCounts.get(s) ?? 0}
            >
              {dict.common.status[s]}
            </FilterChip>
          ))}
        </nav>
      )}

      {posts.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-3xl" aria-hidden>📰</p>
          <p className="mt-3 font-medium">{dict.dashboard.emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {dict.dashboard.emptyDescription}
          </p>
          <Link href="/capture" className="btn-primary mt-5 inline-flex">
            {dict.dashboard.emptyCta}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {posts.map((post, index) => {
            const v = post.versions[0];
            const isFinished =
              post.status === POST_STATUS.PUBLISHED || post.status === POST_STATUS.REJECTED;
            const isManagerOrAdmin = user.role === "admin" || user.role === "manager";
            const canReview =
              !isFinished &&
              (isManagerOrAdmin || (user.role === "staff" && post.author.id !== user.id));
            const alreadyApproved =
              v?.decisions.some((d) => d.reviewerId === user.id) ?? false;
            return (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="card group relative flex flex-wrap overflow-hidden transition-colors hover:border-white/25 sm:block"
              >
                {canReview && v && (
                  <CardQuickActions
                    variant="overlay"
                    postId={post.id}
                    versionId={v.id}
                    hasArt={!!v.renderedArtUrl || !!v.renderedVideoUrl}
                    alreadyApproved={alreadyApproved}
                  />
                )}
                {(isManagerOrAdmin || post.author.id === user.id) && (
                  <DeletePostButton postId={post.id} />
                )}
                <div className="aspect-square w-28 shrink-0 self-start bg-black sm:w-auto">
                  {v?.selectedVideo?.previewFrameUrl ? (
                    // The feed card is only a thumbnail — it uses the video's static
                    // frame instead of the whole rendered MP4 (avoids downloading a
                    // heavy file just to fill a grid cell). Same frame shown in the
                    // editor.
                    <div className="relative h-full w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.selectedVideo.previewFrameUrl}
                        alt={v.title ?? dict.instagramPreview.artAlt}
                        loading={index < 3 ? "eager" : "lazy"}
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      <span
                        aria-hidden
                        className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white backdrop-blur-sm"
                      >
                        ▶
                      </span>
                    </div>
                  ) : v?.renderedVideoUrl ? (
                    // Video already rendered but with no preview frame (rare — an
                    // extraction failure): never embeds the video here, only a visual
                    // hint that it is a video post.
                    <div className="flex h-full items-center justify-center text-2xl text-faint" aria-hidden>
                      ▶
                    </div>
                  ) : v?.renderedArtUrl ? (
                    // Carousel included: only the cover goes in the feed card.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.renderedArtUrl}
                      alt={v.title ?? dict.instagramPreview.artAlt}
                      loading={index < 3 ? "eager" : "lazy"}
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-faint">
                      {dict.dashboard.artNotGenerated}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2 p-3 pr-12 sm:pr-3">
                  <StatusBadge status={post.status} />
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {v?.title ?? dict.dashboard.untitled}
                  </p>
                  <p className="text-xs text-faint">
                    {post.author.name} ·{" "}
                    {new Date(post.updatedAt).toLocaleString(dateLocale, {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {/* Phones only (the inline variant hides itself from sm up): a full-width
                    row under thumbnail + text, so both buttons fit. */}
                {canReview && v && (
                  <div className="basis-full px-3 pb-3 sm:hidden">
                    <CardQuickActions
                      variant="inline"
                      postId={post.id}
                      versionId={v.id}
                      hasArt={!!v.renderedArtUrl}
                      alreadyApproved={alreadyApproved}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {auditLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 text-sm font-semibold text-muted">
            {dict.dashboard.purgedSectionTitle}
          </h2>
          <p className="hint mb-3 mt-0">{dict.dashboard.purgedSectionHint}</p>
          <div className="card divide-y divide-lineSoft">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <StatusBadge status={log.status} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {log.title ?? dict.dashboard.untitled}
                    </p>
                    <p className="text-xs text-faint">{log.authorName}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-faint">
                  {new Date(log.createdAt).toLocaleDateString(dateLocale)} →{" "}
                  {dict.dashboard.purgedAt}{" "}
                  {new Date(log.purgedAt).toLocaleDateString(dateLocale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function FilterChip({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-white bg-white text-black"
          : "border-line bg-surface text-muted hover:border-white/30 hover:text-ink"
      }`}
    >
      {children}
      <span className={`text-xs tabular-nums ${active ? "text-black/60" : "text-faint"}`}>{count}</span>
    </Link>
  );
}
