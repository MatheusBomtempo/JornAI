import { en } from "./en";
import { pt } from "./pt";
import { getContentLanguage } from "./config";
import type { Language, LanguagePack } from "./types";

export type { Language, LanguagePack } from "./types";
export { LANGUAGES } from "./types";
export {
  DEFAULT_LANGUAGE,
  getConfiguredLanguage,
  getContentLanguage,
  parseLanguage,
} from "./config";

const PACKS: Record<Language, LanguagePack> = { pt, en };

/** The language pack for the configured content language (APP_LANGUAGE). */
export function getLanguagePack(): LanguagePack {
  return PACKS[getContentLanguage()];
}
