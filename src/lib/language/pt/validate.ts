import type { SourceSupportRule, ValidationRule } from "../types";

/** Phrases that must NEVER appear in a generated news post. */
export const ALWAYS_FORBIDDEN: ValidationRule[] = [
  {
    pattern: /na altura d[oa] (n[úu]mero|acesso|km)/i,
    rule: 'address formula "na altura de..."',
    fix: 'Remove the "na altura de..." formula — locate the event only by street, neighborhood and city.',
  },
  {
    pattern: /n[ãa]o foi (informad|divulgad|detalhad|revelad)/i,
    rule: 'absence phrase ("não foi informado/divulgado")',
    fix: "Remove phrases about missing information — if the source does not carry a fact, simply do not mention the subject.",
  },
  {
    pattern: /n[ãa]o h[áa] informa[çc]/i,
    rule: 'absence phrase ("não há informações")',
    fix: "Remove phrases about missing information — if the source does not carry a fact, simply do not mention the subject.",
  },
  {
    pattern: /identificad[oa] como/i,
    rule: 'person named ("identificado como...")',
    fix: 'Never name the people involved — use a generic form such as "um homem de 42 anos".',
  },
  {
    pattern: /transfer[êe]ncia de valores/i,
    rule: "administrative report field turned into a sentence",
    fix: "Remove the mention of transfer of funds — it is a system field of the police report, not a fact of the story.",
  },
  {
    pattern: /cr[ée]dito da imagem/i,
    rule: "invented image credit",
    fix: 'Remove the image credit — only use credits that arrive in the "## Credits" block.',
  },
];

/**
 * Terms that may only appear if the source supports them too.
 *
 * The OUTPUT regex has to cover every inflection — noun, adjective AND
 * verb. The first version only caught "interditada"/"interdição" and let the
 * headline "…tomba e interdita BR-040" through in production (source: only
 * "trânsito lento"); "morreu", "bloqueia" and "investiga" slipped through the
 * same way. Hence the short stems ("interdi[tç]", "bloque", "investig",
 * "morr[e…]") instead of whole words.
 */
export const NEEDS_SOURCE_SUPPORT: SourceSupportRule[] = [
  {
    output: /investig/i,
    source: /investiga/i,
    rule: "invented investigation",
    fix: "Remove mentions of an investigation — the source does not describe an ongoing investigation.",
  },
  {
    output: /interdi[tç]/i,
    source: /interdi/i,
    rule: "invented road interdiction",
    fix: "Remove the road interdiction — the source does not mention it.",
  },
  {
    output: /bloque/i,
    source: /bloque/i,
    rule: "invented road blockage",
    fix: "Remove the road blockage — the source does not mention it.",
  },
  {
    output: /desvio de tr[âa]nsito|rotas? alternativ/i,
    source: /desvio|rota/i,
    rule: "invented traffic detour",
    fix: "Remove the detour/alternative route — the source does not mention it.",
  },
  {
    // "morr" only followed by a verb inflection — "morro" (Morro do Papagaio
    // etc.) is Belo Horizonte geography and must not trigger the rule.
    output: /\bmorte|\bmort[oa]s?\b|\bmorr(e|eu|em|eram|er|endo|ia|iam)\b|[óo]bito|falec|\bfata(l|is)\b/i,
    source: /mort|\bmorr(e|eu|em|eram|er|endo|ia|iam)\b|[óo]bito|falec|fatal/i,
    rule: "invented death",
    fix: "Remove any mention of death — the source does not record a fatality.",
  },
  {
    output: /apurar as circunst|circunst[âa]ncias (ser[ãa]o|est[ãa]o sendo) apurad/i,
    source: /apura/i,
    rule: 'invented closing line "apurar as circunstâncias"',
    fix: "Remove the closing line about the circumstances being looked into — end the caption on the last real fact of the source.",
  },
  {
    output: /per[íi]cia/i,
    source: /per[íi]cia/i,
    rule: "invented forensic examination",
    fix: "Remove the mention of forensics — the source does not talk about it.",
  },
];
