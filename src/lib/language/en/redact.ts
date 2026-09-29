import type { RedactionPack, RedactionPattern } from "../types";

const PATTERNS: RedactionPattern[] = [
  { label: "[SSN removed]", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  // North American phone numbers: (555) 123-4567, 555-123-4567, 555.123.4567
  { label: "[phone removed]", re: /(?<!\d)(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?!\d)/g },
  { label: "[email removed]", re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
];

const NAME_REMOVED = "[name removed]";

const NAME_WORD = "[A-Z][a-z]+(?:['’-][A-Z]?[a-z]+)?";
const NAME_PARTICLE = "(?:de|van|von|da|di|la|le|del|al|bin|ibn)";
const NAME = `${NAME_WORD}(?:\\s+(?:${NAME_PARTICLE}\\s+)?${NAME_WORD}){1,3}`;

/**
 * "John Smith, 42," / "John Smith, 42 years old" / "John Smith, aged 42" —
 * the most common way a person is identified in a police report or press
 * release. Not real NER, but "run of capitalized words" + "age right after" is
 * specific enough to keep false positives low. The age stays ("a 42-year-old
 * man" is legitimate information); only the name goes.
 */
const NAME_WITH_AGE_RE = new RegExp(
  `\\b(${NAME})\\s*,?\\s*(?:aged\\s+)?(\\d{1,3})(?=\\s*(?:,|years?[ -]old|yo\\b|-year-old))`,
  "g",
);

// Name preceded by an honorific or job title. The anchor keeps the
// false-positive risk low: a loose capitalized word can be a street, a
// company or a place.
const HONORIFIC_NAME_RE = new RegExp(
  `\\b(Mr\\.?|Mrs\\.?|Ms\\.?|Miss|Dr\\.?|Officer|Ofc\\.?|Sgt\\.?|Sergeant|Detective|Det\\.?|Deputy|Trooper|Lt\\.?|Lieutenant|Capt\\.?|Captain|Nurse|Paramedic|Chief)\\s+(${NAME_WORD}(?:\\s+${NAME_WORD}){0,2})`,
  "g",
);

/** "Elm Street, 12," is an address, not a person. */
const PLACE_SUFFIX_RE =
  /\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Highway|Hwy|Route|Court|Ct|Way|Place|Pl|Park|County|City|Suite|Apt|School|University|College|Hospital|Center|Church)$/;

function redactNames(text: string): { text: string; count: number } {
  let count = 0;
  let out = text.replace(NAME_WITH_AGE_RE, (match, name: string, age: string) => {
    if (PLACE_SUFFIX_RE.test(name)) return match;
    count++;
    return `${NAME_REMOVED}, ${age}`;
  });
  out = out.replace(HONORIFIC_NAME_RE, (_m, honorific: string) => {
    count++;
    return `${honorific} ${NAME_REMOVED}`;
  });
  return { text: out, count };
}

export const redaction: RedactionPack = { patterns: PATTERNS, redactNames };
