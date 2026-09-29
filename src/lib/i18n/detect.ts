import { getConfiguredLanguage } from "../language/config";
import type { Locale } from "./config";

/**
 * APP_LANGUAGE, when set explicitly, is also the default interface language:
 * a deployment that works in Portuguese should open in Portuguese for
 * everyone, wherever they connect from. Each person can still switch it with
 * the language switcher (that choice is stored in the cookie).
 */
export function localeFromEnv(): Locale | null {
  return getConfiguredLanguage();
}

/**
 * Geo (`x-vercel-ip-country` header, only present on Vercel deployments):
 * Brazil -> pt; any other country (US, Europe, etc.) -> en. That is the
 * owner's request: English for US/European IPs, Portuguese only in Brazil.
 */
export function localeFromCountry(country: string | null | undefined): Locale | null {
  if (!country) return null;
  return country.trim().toUpperCase() === "BR" ? "pt" : "en";
}

/**
 * Fallback for when there is no geo (localhost, preview outside Vercel): uses
 * the browser language. Only Portuguese counts as "pt" — everything else
 * becomes English.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;
  return first.startsWith("pt") ? "pt" : "en";
}
