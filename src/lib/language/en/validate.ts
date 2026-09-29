import type { SourceSupportRule, ValidationRule } from "../types";

/** Phrases that must NEVER appear in a generated news post. */
export const ALWAYS_FORBIDDEN: ValidationRule[] = [
  {
    pattern: /at the height of (number|no\.|km)/i,
    rule: 'address formula "at the height of..."',
    fix: 'Remove the "at the height of..." formula — locate the event only by street, neighborhood and city.',
  },
  {
    pattern: /\b(was|were|has been|have been) (not|never) (been )?(disclosed|reported|released|provided|revealed|detailed)/i,
    rule: 'absence phrase ("was not disclosed/reported")',
    fix: "Remove phrases about missing information — if the source does not carry a fact, simply do not mention the subject.",
  },
  {
    pattern: /\bno (further )?information (is|was|has been) (available|provided|released)/i,
    rule: 'absence phrase ("no information is available")',
    fix: "Remove phrases about missing information — if the source does not carry a fact, simply do not mention the subject.",
  },
  {
    pattern: /identified as/i,
    rule: 'person named ("identified as...")',
    fix: 'Never name the people involved — use a generic form such as "a 42-year-old man".',
  },
  {
    pattern: /\b(image|photo|picture) credit/i,
    rule: "invented image credit",
    fix: 'Remove the image credit — only use credits that arrive in the "## Credits" block.',
  },
];

/** Terms that may only appear if the source supports them too. */
export const NEEDS_SOURCE_SUPPORT: SourceSupportRule[] = [
  {
    output: /investigat/i,
    source: /investigat/i,
    rule: "invented investigation",
    fix: "Remove mentions of an investigation — the source does not describe an ongoing investigation.",
  },
  {
    output: /\b(road|street|lane|highway|bridge)s? (clos|block)|\b(clos|block)(es|ed|ing)? (the )?(road|street|lane|highway|bridge)/i,
    source: /clos|block/i,
    rule: "invented road closure",
    fix: "Remove the road closure or blockage — the source does not mention it.",
  },
  {
    output: /\bdetour|alternat(e|ive) routes?/i,
    source: /detour|route/i,
    rule: "invented traffic detour",
    fix: "Remove the detour/alternative route — the source does not mention it.",
  },
  {
    output: /\bdeath|\bdead\b|\bdied\b|\bdies\b|\bkilled\b|\bfatal|\bfatalit|\bdeceased|\blife-?less/i,
    source: /death|dead|\bdied\b|\bdies\b|killed|fatal|deceased|\bdie\b/i,
    rule: "invented death",
    fix: "Remove any mention of death — the source does not record a fatality.",
  },
  {
    output: /circumstances (are|is|will be) (being )?(looked into|investigated|examined|determined)|circumstances surrounding/i,
    source: /circumstances/i,
    rule: 'invented closing line about "the circumstances"',
    fix: "Remove the closing line about the circumstances being looked into — end the caption on the last real fact of the source.",
  },
  {
    output: /forensic|coroner|medical examiner/i,
    source: /forensic|coroner|medical examiner/i,
    rule: "invented forensic examination",
    fix: "Remove the mention of forensics — the source does not talk about it.",
  },
];
