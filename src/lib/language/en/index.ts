import type { LanguagePack } from "../types";
import { WEEKDAYS, findDates, weekdayLine } from "./dates";
import { document } from "./document";
import { prompt } from "./prompt";
import { redaction } from "./redact";
import { ALWAYS_FORBIDDEN, NEEDS_SOURCE_SUPPORT } from "./validate";

/** English (US conventions for dates and spelling). */
export const en: LanguagePack = {
  code: "en",
  intlLocale: "en-US",
  photoSearchLocale: "en-US",
  tempPasswordWord: "success",
  weekdays: WEEKDAYS,
  findDates,
  weekdayLine,
  prompt,
  validation: {
    alwaysForbidden: ALWAYS_FORBIDDEN,
    needsSourceSupport: NEEDS_SOURCE_SUPPORT,
  },
  redaction,
  document,
  mock: {
    fallbackHeadline: "Breaking news",
    subtitle: "Detail generated in development mode, without real AI.",
    captionNotice:
      "Text generated in development mode (mock). Set AI_PROVIDER to use a real AI.",
    imageSuggestions: ["generic news photo", "mock development scene"],
  },
};
