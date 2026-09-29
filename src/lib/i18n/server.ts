import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { localeFromEnv } from "./detect";
import { getDictionary, type Dictionary } from "./dictionary";

/** Locale resolved by the middleware (the cookie is always present after the 1st visit). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : (localeFromEnv() ?? DEFAULT_LOCALE);
}

export async function getServerDictionary(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
