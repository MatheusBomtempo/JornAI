import { getLanguagePack } from "./language";

/**
 * Personal-data redaction by pattern (regex), applied BEFORE the text reaches
 * the AI — a second layer of protection on top of the prompt instruction
 * (defense in depth): even if the model ignored the rule, the data is no
 * longer in the text it receives.
 *
 * The patterns are language- and country-specific (national ID numbers,
 * phone formats, honorifics…), so they live in the language pack — see
 * src/lib/language/<lang>/redact.ts. Only well-formatted identifiers are
 * covered by fixed patterns (low false-positive risk). Names in free prose are
 * not covered (doing that safely would need NER) — that remains the prompt's
 * job. The EXCEPTION is the "Name, NN years" pattern, common enough in police
 * reports (driver, victim, witness) to deserve a dedicated regex.
 */

export interface RedactResult {
  text: string;
  redactedCount: number;
}

/**
 * `keepNames`: for an already published article (link), a person's name is
 * public, journalistic information ("Lucas, 12, is a champion...") — only the
 * sensitive-data patterns (ID numbers, phones…) are still removed. The name
 * regexes exist because of police reports/official documents.
 */
export function redactSensitive(
  text: string,
  opts: { keepNames?: boolean } = {},
): RedactResult {
  const { redaction } = getLanguagePack();
  let redactedCount = 0;
  let out = text;
  for (const { label, re } of redaction.patterns) {
    out = out.replace(re, () => {
      redactedCount++;
      return label;
    });
  }
  if (opts.keepNames) return { text: out, redactedCount };
  const names = redaction.redactNames(out);
  return { text: names.text, redactedCount: redactedCount + names.count };
}
