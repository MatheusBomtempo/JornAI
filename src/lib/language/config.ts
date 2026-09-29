import { LANGUAGES, type Language } from "./types";

/** Used when APP_LANGUAGE is not set — keeps existing deployments unchanged. */
export const DEFAULT_LANGUAGE: Language = "pt";

/**
 * Accepts "pt", "pt-BR", "en", "en-US"… (case-insensitive) and returns the
 * supported language, or null when the value is empty or unsupported.
 */
export function parseLanguage(value: string | null | undefined): Language | null {
  const base = value?.trim().toLowerCase().split(/[-_]/)[0];
  return (LANGUAGES as readonly string[]).includes(base ?? "") ? (base as Language) : null;
}

/**
 * The language explicitly configured through APP_LANGUAGE, or null when the
 * variable is not set. An unsupported value is a configuration mistake, so it
 * fails loudly instead of silently falling back.
 */
export function getConfiguredLanguage(): Language | null {
  const raw = process.env.APP_LANGUAGE;
  if (!raw?.trim()) return null;
  const language = parseLanguage(raw);
  if (!language) {
    throw new Error(
      `Unsupported APP_LANGUAGE "${raw}". Supported values: ${LANGUAGES.join(", ")}.`,
    );
  }
  return language;
}

/** The language JornAI works in: APP_LANGUAGE, or the default. */
export function getContentLanguage(): Language {
  return getConfiguredLanguage() ?? DEFAULT_LANGUAGE;
}
