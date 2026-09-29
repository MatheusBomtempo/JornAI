import type { Credit } from "../domain";

/** A real post example from the newspaper, used as a style reference. */
export interface StyleExampleInput {
  title?: string | null;
  subtitle?: string | null;
  caption?: string | null;
}

/**
 * Input of the AI pipeline (text only — no vision and no image generation).
 * Capture is unified: the reporter sends what they have and the AI infers the
 * context (section, tone, region) by itself.
 */
export interface GenerateInput {
  /** Text gathered/pasted by the reporter. */
  text?: string | null;
  /** Source link, when the source was a URL. */
  sourceUrl?: string | null;
  /** Supporting material: content of the link and/or attached document (PDF). */
  scrapedContent?: string | null;
  /** Whether the post has a photo. */
  hasPhoto?: boolean;
  /** Credits/tags that must go at the end of the caption. */
  credits?: Credit[] | null;
  /** Style examples from the newspaper. */
  examples?: StyleExampleInput[] | null;
  /** Adjustment requested on regeneration ("shorter", "more sober tone"…). */
  guidance?: string | null;
}

/** Structured output of the AI. */
export interface GeneratedContent {
  /** Art title — max. 69 characters. */
  title: string;
  /** Art subtitle — max. 149 characters. */
  subtitle: string;
  /** Full Instagram caption (with hashtags). */
  instagramCaption: string;
  /**
   * Exactly 2 short image-search suggestions (e.g. "police car patrol"), to
   * help the reporter find a photo when they do not have one yet. Purely
   * auxiliary: it never picks, downloads or publishes an image on its own.
   */
  imageSuggestions: string[];
  /**
   * Who actually generated it — important with provider fallback: the post
   * may have been written by the main provider or by one of the backups.
   */
  meta?: { provider: string; model: string };
}

export interface AiProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<GeneratedContent>;
}
