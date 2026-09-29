/**
 * Content language: the language JornAI WORKS in — the language the source
 * material is written in and the language the generated posts come out in.
 * Chosen once per deployment with the APP_LANGUAGE environment variable.
 *
 * This is NOT the interface language (that is a per-user choice, see
 * src/lib/i18n). Everything that depends on the content language — the
 * prompt's examples, the factual validator, personal-data redaction, date
 * and weekday handling — lives in a LanguagePack, so adding a language means
 * adding one pack, not touching the pipeline.
 */
export const LANGUAGES = ["pt", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export interface DateMatch {
  /** The date exactly as written in the text (e.g. "19/08/2026"). */
  raw: string;
  date: Date;
}

export interface Weekday {
  /** Canonical name as it must appear in the generated text (lower case). */
  name: string;
  /** Matches the weekday in generated text, including its usual variants. */
  pattern: RegExp;
  /** Lower-case fragment used to look for the weekday inside the source. */
  sourceStem: string;
}

/** Pieces of the system prompt that are language- or newsroom-specific. */
export interface PromptPack {
  /** Human name of the output language, e.g. "Brazilian Portuguese". */
  languageName: string;
  /** Who the model is writing for, e.g. "a newspaper newsroom in Minas Gerais". */
  newsroom: string;
  /** Name of the computed weekday line the source carries. */
  weekdayField: string;
  /** Two short bullets showing "rephrase the form, never the fact". */
  fidelityExamples: string;
  /** "na altura do número X"-style address formulas the model must avoid. */
  addressFormula: string;
  /** Closing filler the model must not invent. */
  closingFiller: string;
  /** Absence phrases the model must not write. */
  absencePhrases: string;
  /** Example of an administrative form field that is never news. */
  adminFieldExample: string;
  /** Body of the "named people" section (examples in the output language). */
  namesAndAge: string;
  /** Right/wrong headline examples. */
  titleExamples: string;
  /** One good subtitle example. */
  subtitleExample: string;
  /** Image-search suggestion examples. */
  imageSuggestionExamples: string;
  /** Body of the language/style section. */
  styleGuide: string;
  /** How to refer to people generically, e.g. "um homem de 42 anos". */
  genericPersonExamples: string;
  /** Hashtag rules, one bullet per line. */
  hashtagRules: string;
}

export interface ValidationRule {
  pattern: RegExp;
  rule: string;
  fix: string;
}

export interface SourceSupportRule {
  /** Matches the claim in the generated text. */
  output: RegExp;
  /** Must match somewhere in the source for the claim to be allowed. */
  source: RegExp;
  rule: string;
  fix: string;
}

export interface RedactionPattern {
  label: string;
  re: RegExp;
}

export interface RedactionPack {
  /** Well-formatted identifiers (national IDs, phones, plates, ...). */
  patterns: RedactionPattern[];
  /** Removes personal names from prose; returns how many it removed. */
  redactNames(text: string): { text: string; count: number };
}

export interface DocumentPack {
  /** Two or more hits mean "official document with labelled fields". */
  structuredSignals: RegExp[];
  /** "Narrative: ..." inline (not as a section header of its own). */
  narrativeInline: RegExp;
  /** "## NARRATIVE" section header — the next paragraph is the value. */
  narrativeHeader: RegExp;
  docTypeHeader: RegExp;
  /** Words stripped from a label when building its key ("of the incident"). */
  labelNoise: RegExp;
  /** Display names for keys captured without an original label. */
  fieldLabels: { type: string; narrative: string };
  /**
   * Cleaning profile for official FORMS whose PDF text comes out as loose
   * cells (Brazilian police reports). Null when the language has none.
   */
  form: {
    looksLikeForm(markdown: string): boolean;
    clean(markdown: string): { text: string };
  } | null;
}

export interface LanguagePack {
  code: Language;
  /** BCP-47 tag, for Intl formatting. */
  intlLocale: string;
  /** Locale hint for the Pexels photo search. */
  photoSearchLocale: string;
  /** Word that starts a generated temporary password ("success" → "success57"). */
  tempPasswordWord: string;
  weekdays: Weekday[];
  /** Every calendar date written in the way this language writes them. */
  findDates(text: string): DateMatch[];
  /** The weekday line appended to the source: date + computed weekday. */
  weekdayLine(rawDate: string, weekday: string): string;
  prompt: PromptPack;
  validation: {
    alwaysForbidden: ValidationRule[];
    needsSourceSupport: SourceSupportRule[];
  };
  redaction: RedactionPack;
  document: DocumentPack;
  /** Copy used by the offline mock provider. */
  mock: {
    fallbackHeadline: string;
    subtitle: string;
    captionNotice: string;
    imageSuggestions: [string, string];
  };
}
