import type { LanguagePack } from "../types";
import { WEEKDAYS, findDates, weekdayLine } from "./dates";
import { document } from "./document";
import { prompt } from "./prompt";
import { redaction } from "./redact";
import { ALWAYS_FORBIDDEN, NEEDS_SOURCE_SUPPORT } from "./validate";

/** Brazilian Portuguese — the language JornAI was first built for. */
export const pt: LanguagePack = {
  code: "pt",
  intlLocale: "pt-BR",
  // Without a locale Pexels reads the query as English: "galpão em chamas"
  // returned a fox photo; with pt-BR, 12 of 15 results were about fires.
  photoSearchLocale: "pt-BR",
  tempPasswordWord: "sucesso",
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
    fallbackHeadline: "Notícia de última hora",
    subtitle: "Detalhe gerado em modo de desenvolvimento, sem IA real.",
    captionNotice:
      "Texto gerado em modo de desenvolvimento (mock). Configure AI_PROVIDER para usar IA de verdade.",
    imageSuggestions: ["foto genérica notícia", "cena mock desenvolvimento"],
  },
};
