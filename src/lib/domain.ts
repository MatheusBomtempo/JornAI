/**
 * Single source of truth of the JornAI domain: roles, post states, version
 * origins and review decisions. Mirrors the state machine of SPEC.md.
 */

export const USER_ROLES = ["admin", "manager", "staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Publishing a post created by staff (reporter): admin/manager publish with 1
 * approval (their own authority); staff alone cannot approve their own story,
 * so it needs this many peers (reporters) to guarantee peer review before it
 * goes live.
 */
export const PEER_APPROVALS_NEEDED = 2;

/**
 * Most images one Instagram carousel takes (Graph API limit) — the cover art
 * included. Photos only: Reels/videos never go into a carousel here.
 */
export const CAROUSEL_MAX = 10;

/** Estados do post (coluna posts.status). */
export const POST_STATUS = {
  PROCESSING_AI: "processing_ai",
  EDITING_ART: "editing_art",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  REJECTED: "rejected",
  FAILED: "failed",
} as const;
export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];

export const SOURCE_TYPES = ["photo", "text", "link", "document"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Post credits/tags (@profile). The emoji goes in the caption before the @,
 * following the newsroom's standard: "📸 @photographer".
 */
export const CREDIT_TYPES = [
  { id: "photo", emoji: "📸" },
  { id: "source", emoji: "🗣️" },
  { id: "video", emoji: "🎥" },
  { id: "report", emoji: "✍️" },
  { id: "partner", emoji: "🤝" },
  { id: "mention", emoji: "@" },
] as const;

export type CreditTypeId = (typeof CREDIT_TYPES)[number]["id"];

export interface Credit {
  type: CreditTypeId;
  handle: string;
}

export function creditEmoji(type: CreditTypeId): string {
  return CREDIT_TYPES.find((c) => c.id === type)?.emoji ?? "@";
}

/** Normalizes the @ typed by the user (accepts with or without the at-sign). */
export function normalizeHandle(raw: string): string {
  const clean = raw.trim().replace(/^@+/, "").replace(/\s+/g, "");
  return clean ? `@${clean}` : "";
}

/** Credits line as it goes in the caption: "📸 @someone". */
export function formatCredit(c: Credit): string {
  const handle = normalizeHandle(c.handle);
  if (!handle) return "";
  return c.type === "mention" ? handle : `${creditEmoji(c.type)} ${handle}`;
}

/**
 * Sorts templates for display/default selection: more "portrait" formats
 * first (4:5 before 1:1) — it is the newsroom's standard and therefore what
 * shows up pre-selected in the art editor. Based on the real proportion
 * (height/width), not on creation order, so it stays correct even if a
 * template is recreated or the registration order changes.
 */
export function sortTemplatesByFormat<
  T extends { canvasWidth: number; canvasHeight: number; createdAt: Date | string },
>(templates: T[]): T[] {
  return [...templates].sort((a, b) => {
    const ratioA = a.canvasHeight / a.canvasWidth;
    const ratioB = b.canvasHeight / b.canvasWidth;
    if (ratioA !== ratioB) return ratioB - ratioA; // taller (portrait) first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export const VERSION_ORIGINS = [
  "ai_generated",
  "manual_edit",
  "ai_regenerated",
] as const;
export type VersionOrigin = (typeof VERSION_ORIGINS)[number];

export const REVIEW_DECISIONS = [
  "approved",
  "rejected",
  "regenerate",
  "manual_edit",
] as const;
export type ReviewDecisionKind = (typeof REVIEW_DECISIONS)[number];

export const PUBLICATION_STATUS = {
  PENDING: "pending",
  CONTAINER_CREATED: "container_created",
  PUBLISHED: "published",
  FAILED: "failed",
} as const;
export type PublicationStatus =
  (typeof PUBLICATION_STATUS)[keyof typeof PUBLICATION_STATUS];

export const PUBLICATION_KIND = {
  FEED: "feed",
  STORY: "story",
} as const;

/**
 * Allowed status transitions. Basis for validating state changes and for
 * eventual UI checks.
 */
export const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  processing_ai: ["editing_art", "failed"],
  editing_art: ["in_review", "editing_art"],
  in_review: ["approved", "rejected", "processing_ai", "editing_art"],
  approved: ["publishing"],
  publishing: ["published", "failed"],
  published: [],
  rejected: [],
  failed: ["processing_ai", "editing_art"],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
