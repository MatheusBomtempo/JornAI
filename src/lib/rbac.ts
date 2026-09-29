import { forbidden } from "./http";
import type { UserRole } from "./domain";

type HasRole = { role: UserRole; id: string };

/** Makes sure the user has one of the roles; otherwise throws 403. */
export function requireRole<T extends HasRole>(
  user: T,
  ...roles: UserRole[]
): T {
  if (!roles.includes(user.role)) {
    throw forbidden(
      `Action restricted to the roles: ${roles.map(labelRole).join(", ")}.`,
    );
  }
  return user;
}

// Permissions derived from the roles table of the SPEC.
export const can = {
  /** Creates sources/posts: every authenticated role. */
  createPost: (_u: HasRole) => true,
  /** Aprova/recusa/refaz/publica: manager e admin. */
  review: (u: HasRole) => u.role === "manager" || u.role === "admin",
  publish: (u: HasRole) => u.role === "manager" || u.role === "admin",
  /** Edita style reference e templates: manager e admin. */
  editStyle: (u: HasRole) => u.role === "manager" || u.role === "admin",
  editTemplates: (u: HasRole) => u.role === "manager" || u.role === "admin",
  /** Manages users and API keys: admin only. */
  manageUsers: (u: HasRole) => u.role === "admin",
  manageApiKeys: (u: HasRole) => u.role === "admin",
};

/**
 * Staff (reporter) can only edit their own submissions before approval.
 * Manager/admin can edit any submission.
 */
export function canEditPost(
  user: HasRole,
  post: { createdBy: string },
): boolean {
  if (user.role === "admin" || user.role === "manager") return true;
  return post.createdBy === user.id;
}

/**
 * Peer review: manager/admin review (and publish) any post. Staff can review
 * (approve/reject/ask for a rewrite) posts by OTHER reporters — never their
 * own, otherwise peer review becomes decoration. See PEER_APPROVALS_NEEDED: a
 * staff approval alone does not publish, it must add up with one from a
 * different peer (or come from a manager/admin).
 */
export function canReviewPost(
  user: HasRole,
  post: { createdBy: string },
): boolean {
  if (user.role === "admin" || user.role === "manager") return true;
  return user.role === "staff" && post.createdBy !== user.id;
}

function labelRole(role: UserRole): string {
  return { admin: "admin", manager: "manager", staff: "staff" }[role];
}
