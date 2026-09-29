/**
 * Geometry of the video post (Reels 9:16) — shared between the server render
 * (ffmpeg + Sharp) and the editor preview in the browser. Both MUST use the
 * same numbers: the preview is only worth anything if what the reporter sees
 * on screen is where the text really lands in the final video.
 *
 * No "server-only" on purpose — it is just constants and arithmetic, and the
 * client imports from here.
 */

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
/** Every video is normalized to this proportion, no matter what was uploaded. */
export const VIDEO_ASPECT = VIDEO_WIDTH / VIDEO_HEIGHT; // 9:16

/**
 * Bands that the Instagram interface covers on Reels — text and logo never go
 * into them, otherwise they end up hidden behind the profile/caption/buttons.
 */
export const SAFE_TOP = Math.round(VIDEO_HEIGHT * 0.14); // 269px
export const SAFE_BOTTOM = Math.round(VIDEO_HEIGHT * 0.2); // 384px
export const SAFE_X = Math.round(VIDEO_WIDTH * 0.06); // 65px
/** Column of buttons (like/comment/send) on the right. */
export const SAFE_RIGHT_ACTIONS = Math.round(VIDEO_WIDTH * 0.19); // 205px

/** Where the usable area ends (start of the caption/profile band). */
export const CONTENT_BOTTOM = VIDEO_HEIGHT - SAFE_BOTTOM;

// ── Title card ───────────────────────────────────────────────
export const CARD_WIDTH = VIDEO_WIDTH - SAFE_X * 2;
export const CARD_PADDING_X = 40;
export const CARD_PADDING_Y = 28;
export const TITLE_FONT_SIZE = 58;
export const TITLE_LINE_HEIGHT = 1.22;
export const TITLE_MAX_TEXT_HEIGHT = 320;

// ── Logo da empresa (abaixo do texto, centralizada) ──────────
export const LOGO_HEIGHT = 120;
export const LOGO_GAP = 24;

/**
 * Fixed styles of the video's title card — the reporter picks one, another
 * cannot be created (unlike the photo's ArtTemplate, which has a builder).
 * `accent` is a decorative colored bar (card width); null in the styles that
 * do not have it.
 */
export interface VideoCardStyle {
  id: "classic" | "light" | "bold";
  /** Background color of the card. */
  cardFill: string;
  /** Opacity of the background (0–1) — the video behind shows through it. */
  cardOpacity: number;
  cardRadius: number;
  /** Subtle border (blends better with light backgrounds); null = no border. */
  cardBorder: string | null;
  textColor: string;
  /** Highlight bar at the top of the card, in the newspaper's brand color. */
  accentColor: string | null;
  accentHeight: number;
}

/** Brand colors configured by the company (Admin → Company). Both optional. */
export interface CompanyBrandColors {
  dark?: string | null;
  light?: string | null;
}

/** Used when the company has not configured the brand colors yet. */
export const FALLBACK_BRAND_DARK = "#111827";
export const FALLBACK_BRAND_LIGHT = "#f8fafc";

/**
 * Builds the 3 fixed styles with the newspaper's brand colors. "Classic" is
 * always black/white, regardless of the company — only "Light" and "Highlight"
 * use the configured dark/light color (or the fallback, if the company has not
 * configured any yet).
 */
export function buildVideoCardStyles(
  colors: CompanyBrandColors = {},
): Record<VideoCardStyle["id"], VideoCardStyle> {
  const dark = colors.dark || FALLBACK_BRAND_DARK;
  const light = colors.light || FALLBACK_BRAND_LIGHT;

  return {
    classic: {
      id: "classic",
      cardFill: "#000000",
      cardOpacity: 0.5,
      cardRadius: 24,
      cardBorder: null,
      textColor: "#ffffff",
      accentColor: null,
      accentHeight: 0,
    },
    light: {
      id: "light",
      cardFill: "#f8fafc",
      cardOpacity: 0.96,
      cardRadius: 16,
      cardBorder: "rgba(15,23,42,0.08)",
      textColor: "#0f172a",
      accentColor: dark,
      accentHeight: 8,
    },
    bold: {
      id: "bold",
      cardFill: dark,
      cardOpacity: 1,
      cardRadius: 0,
      cardBorder: null,
      textColor: "#ffffff",
      accentColor: light,
      accentHeight: 3,
    },
  };
}

// "bold" is the 3rd template (see VIDEO_TEMPLATE_ORDER in VideoEditor) — it is
// pre-selected both in the UI and in the server-side render fallback.
export const DEFAULT_VIDEO_TEMPLATE: VideoCardStyle["id"] = "bold";

// ── Animation (seconds) ────────────────────────────────────────
// Entry and exit use easing (smoothstep) instead of linear progress — see
// `smoothstep`/`clamp01Progress` in render/video.ts — and the exit also
// slides (not just disappears), to be symmetric with the entry and look more
// fluid. The entry is fixed at the start; the exit is relative to the END of
// the video (see `titleTiming`) — the title stays on screen for the whole
// video and only goes away shortly before it ends, instead of flashing for
// 4 s in a 15 s Reels.
export const FADE_IN_START = 0.28;
export const FADE_IN_END = 1.05;
/** Duration of the exit fade/slide. */
export const EXIT_DURATION = 0.75;
/** Slack between the end of the exit and the end of the video — the exit has to finish before the last frame. */
export const EXIT_END_MARGIN = 0.35;
/** Minimum still reading time between the end of the entry and the start of the exit. */
export const MIN_HOLD = 0.8;
/** Fixed window (old behavior) for when ffprobe does not report the duration. */
export const FALLBACK_CARD_END = 4.35;
/** Px the block rises during the entry. */
export const SLIDE_DISTANCE = 46;
/** Px the block drops during the exit (subtler than the entry). */
export const EXIT_SLIDE_DISTANCE = 22;

export interface TitleTiming {
  /** Start and end of the exit fade/slide; null = stays until the end, no exit. */
  exitStart: number | null;
  exitEnd: number | null;
  /** Until when the card stream exists (the `-t` of the looped PNG). */
  cardEnd: number;
}

/**
 * Timing of the card from the video's duration. ffmpeg's `fade` only accepts
 * absolute instants, so the exit is computed here: it ends `EXIT_END_MARGIN`
 * before the end and lasts `EXIT_DURATION`. A video too short for entry +
 * reading + exit keeps the card until the end, with no exit. With no known
 * duration, it falls back to the old fixed window — better than risking an
 * infinite card stream (an encode that never ends).
 */
export function titleTiming(durationSec: number): TitleTiming {
  if (!(durationSec > 0)) {
    return {
      exitStart: FALLBACK_CARD_END - EXIT_DURATION,
      exitEnd: FALLBACK_CARD_END,
      cardEnd: FALLBACK_CARD_END,
    };
  }
  const exitEnd = round2(durationSec - EXIT_END_MARGIN);
  const exitStart = round2(exitEnd - EXIT_DURATION);
  if (exitStart < FADE_IN_END + MIN_HOLD) {
    return { exitStart: null, exitEnd: null, cardEnd: round2(durationSec) };
  }
  return { exitStart, exitEnd, cardEnd: exitEnd };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Default Y of the top of the block (text + logo): flush with the end of the safe area. */
export function defaultGroupTop(groupHeight: number): number {
  return CONTENT_BOTTOM - groupHeight;
}

/**
 * Keeps the whole block inside the safe area, whatever the reporter's
 * adjustment — it is what guarantees the text never overlaps the Reels UI.
 */
export function clampGroupTop(top: number, groupHeight: number): number {
  const max = CONTENT_BOTTOM - groupHeight;
  if (max <= SAFE_TOP) return SAFE_TOP;
  return Math.min(max, Math.max(SAFE_TOP, top));
}

/**
 * A truly LANDSCAPE video (width > height, e.g. 16:9) — instead of cropping the
 * sides, the render uses an enlarged, mirrored, blurred copy of the video
 * itself as the background, and keeps the whole original centered on top (see
 * blurPadGraph in render/video.ts). Nothing of the image is lost.
 *
 * Important: do NOT use "srcAspect > VIDEO_ASPECT" here — since 9:16 is much
 * narrower than most common formats, that would classify even vertical video
 * (4:5, 3:4) as "landscape". The right criterion is width > height.
 */
export function needsBlurBackground(srcWidth: number, srcHeight: number): boolean {
  if (!srcWidth || !srcHeight) return false;
  return srcWidth > srcHeight;
}

/**
 * How much of the uploaded video is lost when normalizing to 9:16 (0 =
 * nothing). Landscape video no longer falls here — see `needsBlurBackground` —
 * only vertical video wider than 9:16 (crops the sides, e.g. 4:5, 3:4) or
 * taller (crops top/bottom).
 */
export function cropLossRatio(srcWidth: number, srcHeight: number): number {
  if (!srcWidth || !srcHeight || needsBlurBackground(srcWidth, srcHeight)) return 0;
  const srcAspect = srcWidth / srcHeight;
  if (srcAspect > VIDEO_ASPECT) return 1 - VIDEO_ASPECT / srcAspect;
  return 1 - srcAspect / VIDEO_ASPECT;
}
