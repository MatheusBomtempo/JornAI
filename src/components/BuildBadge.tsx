/**
 * Tiny, faint label showing which branch/commit this deployment was built
 * from — only for whoever runs the project to tell deployments apart at a
 * glance. Reads the system variables Vercel exposes; locally it says "local".
 * Non-interactive and nearly invisible, so it never bothers the users.
 */
export function BuildBadge() {
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const label = branch ? `${branch}${sha ? ` · ${sha}` : ""}` : "local";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-0.5 left-1.5 z-[60] select-none text-[9px] leading-none text-muted opacity-40"
    >
      {label}
    </div>
  );
}
