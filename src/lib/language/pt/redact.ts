import type { RedactionPack, RedactionPattern } from "../types";

const PATTERNS: RedactionPattern[] = [
  { label: "[CPF removido]", re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
  // CPF without punctuation — that is how a real police report comes out of
  // the PDF extractor ("06667812658"). 11 bare digits are never news; if they
  // ever turn out to be something else (a protocol number), removing them
  // costs nothing.
  { label: "[CPF removido]", re: /\b\d{11}\b/g },
  // Phone with the area code in parentheses, tolerant of unusual regional
  // grouping — "(32)985-088-865" showed up in a real report.
  { label: "[telefone removido]", re: /\(\d{2}\)\s?\d[\d\-. ]{6,11}\d/g },
  { label: "[placa removida]", re: /\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/g }, // old and Mercosul plates
  { label: "[CEP removido]", re: /\b\d{5}-\d{3}\b/g },
];

const NAME_REMOVED = "[nome removido]";

/**
 * "Fulano de Tal, de 42 anos" / "Fulano, 42 anos" — the most common way a
 * person is identified in a police report. It is not real NER, but the
 * combination "run of capitalized words" + "age right after" is specific
 * enough to have a low false-positive risk (street and neighborhood names are
 * not followed by "NN anos"). The age stays — it is legitimate journalistic
 * information ("um homem de 42 anos") — only the name goes.
 */
const NAME_WORD = "[A-ZÀ-Ú][a-zà-ÿ]+";
const NAME_CONNECTOR = "(?:d[aeo]s?|e)";
const NAME_WITH_AGE_RE = new RegExp(
  `\\b(${NAME_WORD}(?:\\s+(?:${NAME_CONNECTOR}\\s+)?${NAME_WORD}){1,4})\\s*,?\\s*(?:de\\s+|com\\s+)?(\\d{1,3})\\s*anos\\b`,
  "g",
);
// ALL-CAPS variant — police reports are often typed entirely in capitals
// ("JOSE PAULO JUVENCIO, 42 ANOS"), which slips past the pattern above.
const CAPS_NAME_WORD = "[A-ZÀ-Ú]{2,}";
const CAPS_NAME_WITH_AGE_RE = new RegExp(
  `\\b(${CAPS_NAME_WORD}(?:\\s+(?:D[AEO]S?\\s+|E\\s+)?${CAPS_NAME_WORD}){1,5})\\s*,?\\s*(?:DE\\s+|COM\\s+|de\\s+|com\\s+)?(\\d{1,3})\\s*(?:anos|ANOS)\\b`,
  "g",
);

// ALL-CAPS name preceded by an honorific or job title — that is how people
// appear in the prose of a report's narrative ("SR JOSÉ PAULO JUVENCIO",
// "PERITO ODAIR", "TÉCNICA DE ENFERMAGEM FRANCIELE"). The honorific anchor is
// what keeps the false-positive risk low: loose capitals without it can be a
// street, a company or an acronym.
// "(?<!NOSSA )" protects religious place names ("NOSSA SENHORA APARECIDA" in
// a bus line or neighborhood name — it showed up in a real report).
const HONORIFIC_NAME_RE = new RegExp(
  `\\b(?<!NOSSA )(SR\\.?|SRA\\.?|SENHORA?|DR\\.?|DRA\\.?|PERIT[OA]|T[ÉE]CNIC[OA] DE ENFERMAGEM|ENFERMEIR[OA]|SOLDADO|CABO|SARGENTO|TENENTE|POLICIAL)\\s+(${CAPS_NAME_WORD}(?:\\s+(?:D[AEO]S?\\s+|E\\s+)?${CAPS_NAME_WORD}){0,4})`,
  "g",
);

/**
 * Capitalized word that looks like a conjugated verb ("DIRECIONOU",
 * "RELATARAM") — in an all-caps text the name regex cannot tell a name from
 * the verb right after it; this heuristic gives the verb back to the text.
 */
const TRAILING_VERB_RE = /\s+[A-ZÀ-Ú]{3,}(OU|ARAM|ERAM|IRAM|AVA|AVAM|IA|IAM)$/;

function redactNames(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const re of [NAME_WITH_AGE_RE, CAPS_NAME_WITH_AGE_RE]) {
    out = out.replace(re, (_m, _name: string, age: string) => {
      count++;
      return `${NAME_REMOVED}, ${age} anos`;
    });
  }
  out = out.replace(HONORIFIC_NAME_RE, (_m, honorific: string, name: string) => {
    count++;
    let verbTail = "";
    const verb = name.match(TRAILING_VERB_RE);
    if (verb) verbTail = verb[0];
    return `${honorific} ${NAME_REMOVED}${verbTail}`;
  });
  return { text: out, count };
}

export const redaction: RedactionPack = { patterns: PATTERNS, redactNames };
