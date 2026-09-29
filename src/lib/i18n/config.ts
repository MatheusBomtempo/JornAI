/**
 * INTERFACE language only. It must never be read by the AI pipeline
 * (src/lib/ai/*) — the language of the generated post is a deployment-wide
 * choice (APP_LANGUAGE, see src/lib/language), no matter which language the
 * person is browsing the product in.
 */
export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * With no signal at all (no cookie, no APP_LANGUAGE, no geo, no
 * Accept-Language) it falls back to English — only Portuguese is treated as a
 * special case (Brazil), see detect.ts.
 */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
