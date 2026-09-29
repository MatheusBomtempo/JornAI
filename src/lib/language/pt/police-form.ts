/**
 * Cleaning profile for official FORMS (Minas Gerais SISP/PM-MG police reports
 * and similar — "BO", boletim de ocorrência).
 *
 * In these PDFs the text extractor dumps every form cell on a loose line:
 * ALL-CAPS labels turn into "## HEADER" in markdownify and the value floats in
 * the neighboring paragraph — sometimes AFTER the label, sometimes BEFORE.
 * Worse: labels that repeat (one per person involved, e.g. "NOME COMPLETO")
 * are removed by markdownify's header/footer dedup and their values are left
 * orphaned — label-driven personal-data removal fails for person 2 and on
 * (real names leaked in testing).
 *
 * So the strategy here is a WHITELIST: instead of trying to enumerate what to
 * remove (bureaucracy, personal records, vehicles, chassis numbers…), the
 * final text is built ONLY from what is known to be newsworthy:
 *
 *   1. Distilled fields (nature, presumed cause, place, city, dates, vehicle
 *      type/make, number of occupants).
 *   2. A summary of the people involved, built from CONTENT (not labels):
 *      kind of involvement, injury severity, detectable ages.
 *   3. The full NARRATIVE ("histórico"), re-joining the fragments the PDF's
 *      line wrapping promoted to "headers" ("## POSTE DE ILUMINAÇÃO.").
 *
 * Everything not recognized is discarded — name, parentage, CPF, RG, home
 * address, phone, driver's license, chassis number etc. never reach the prompt
 * by construction. 100% deterministic, zero AI.
 *
 * The regexes and display strings below are DATA: they match the Portuguese
 * text of the Brazilian form and the labels shown to the model.
 */

const NARRATIVE_HEADER_FORM =
  /^##?\s*(HIST[ÓO]RICO|RELATO|DESCRI[ÇC][ÃA]O DOS FATOS)\b/i;

/** After the narrative come system sections — any of them ends it. */
const NARRATIVE_TERMINATOR =
  /^(Per[íi]cia T[ée]cnica|PREFIXO|PLACA DA VIATURA|PERITO|VIATURAS?\b|MERCADORIAS?|OBJETOS?\b|ARMAS?\b|DIGITADOR|GERADO POR)/i;

interface NewsField {
  key: string;
  display: string;
  label: RegExp;
  /** The neighbor only counts as the value if it looks like this. */
  valueLooksLike: RegExp;
  collectAll?: boolean;
  /** Extracts only part of the neighbor (e.g. "5 FOI POSSÍVEL..." → "5"). */
  extract?: RegExp;
}

const ANY_TEXT = /^.{2,140}$/;
const DATE_TIME = /^[\d/: ]{4,25}$/;

const NEWS_FIELDS: NewsField[] = [
  {
    key: "cause",
    display: "Causa presumida (registrada no BO)",
    label: /^CAUSA PRESUMIDA$/,
    valueLooksLike: ANY_TEXT,
  },
  {
    key: "place",
    display: "Local do fato",
    label: /^LOCAL \(AV/,
    valueLooksLike: ANY_TEXT,
  },
  {
    key: "city",
    display: "Município",
    label: /^MUNIC[ÍI]PIO$/,
    valueLooksLike: /^[A-ZÀ-Ú][A-ZÀ-Ú ]{2,40}$/,
  },
  {
    key: "neighborhood",
    display: "Bairro",
    label: /^BAIRRO\b/,
    valueLooksLike: /^[A-ZÀ-Ú][A-ZÀ-Ú ]{2,40}$/,
  },
  {
    key: "report_date",
    display: "Data da comunicação",
    label: /^DATA DA COMUNICA[ÇC][ÃA]O/,
    valueLooksLike: /^\d{1,2}\/\d{1,2}\/\d{4}/,
  },
  {
    key: "report_time",
    display: "Hora da comunicação",
    label: /^DATA DA COMUNICA[ÇC][ÃA]O HORA/,
    valueLooksLike: /^\d{1,2}:\d{2}$/,
  },
  {
    key: "registration_date",
    display: "Data e hora do registro",
    label: /^DATA DO REGISTRO$/,
    valueLooksLike: DATE_TIME,
  },
  {
    key: "vehicle_type",
    display: "Tipo de cada veículo envolvido, em ordem",
    label: /^TIPO DE VE[ÍI]CULO$/,
    valueLooksLike: /^[A-ZÀ-Ú][A-ZÀ-Ú /]{2,40}$/,
    collectAll: true,
  },
  {
    key: "vehicle_make",
    display: "Marca/modelo de cada veículo, em ordem",
    label: /^MARCA ?\/ ?MODELO$/,
    valueLooksLike: /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 /.-]{2,50}$/,
    collectAll: true,
  },
  {
    key: "occupants",
    display: "Nº de ocupantes de cada veículo, em ordem",
    label: /^N[°º] OCUPANTES$/,
    valueLooksLike: /^\d{1,3}\b/,
    collectAll: true,
    extract: /^(\d{1,3})\b/,
  },
  {
    key: "ages",
    display: "Idades identificadas entre os envolvidos (em anos)",
    label: /^IDADE APARENTE$/,
    valueLooksLike: /^\d{1,3}$/,
    collectAll: true,
  },
];

/** Form labels (any of them) — a neighbor like this is never a value. */
const FORM_LABELS = NEWS_FIELDS.map((f) => f.label).concat([
  /^N[ÚU]MERO|^COMPLEMENTO|^CEP$|^UF\b|^PA[ÍI]S|^KM$/,
  /^SITUA[ÇC][ÃA]O|^ESP[ÉE]CIE$|^CATEGORIA$|^CHASSI$|^RENAVAM$|^PLACA$/,
  /^COR |^ANO |^SEGURO|^NOME|^EMAIL|^DADOS|^TIPO\b|^GRAU DA LES/,
  /^IDADE APARENTE|^SEXO\b|^DESCRI[ÇC][ÃA]O/,
]);

// ── Content recognized by PATTERN (independent of a live label) ─────────────
const NATURE_CODE = /^T\d{4,6} ?- ?(.{4,80})$/;
// Requires the gender prefix — that is how SISP writes it ("MASCULINO CONDUTOR
// DO VEICULO"); without it, a bare "PASSAGEIRO" (vehicle species) polluted
// the result.
const INVOLVEMENT =
  /^(MASCULINO|FEMININO)\s+(CONDUTOR|V[ÍI]TIMA|TESTEMUNHA|PASSAGEIR|AUTOR|SUSPEIT)[A-ZÀ-Ú ()./]{0,60}$/;
const INJURY =
  /^(SEM LES[ÕO]ES APARENTES|LEVES?|GRAVES?|GRAV[ÍI]SSIMAS?|FATAL|FATAIS)$/;
const BIRTH_WITH_AGE = /^\d{1,2}\/\d{1,2}\/\d{4}\s+(\d{1,3})$/;

// ── Harvesting names from the discarded personal records ─────────────────────
// A paragraph of 2-6 ALL-CAPS words, letters only, that is not a label, a
// recognized value, an address or an institution, is almost always a person's
// name from the involved person's record. Those names are harvested and
// removed from the NARRATIVE by exact match (accent-tolerant) — the most
// precise protection possible: it removes exactly the people in the
// document, nothing else.
const NAMEISH_PARAGRAPH = /^[A-ZÀ-Ú]{2,}(?:\s+[A-ZÀ-Ú]{2,}){1,5}$/;
const ADDRESSISH_START =
  /^(RUA|AV|AVENIDA|TRAVESSA|ALAMEDA|PRA[ÇC]A|ROD|RODOVIA|ESTRADA|BECO)\b/;
const INSTITUTION_WORDS =
  /\b(POLICIA|POL[ÍI]CIA|MILITAR|CIVIL|PENAL|BOMBEIRO|SAMU|SETRAN|COPOM|GUARDA|HOSPITAL|DELEGACIA|PERICIA|PER[ÍI]CIA|VIATURA|TRANSPORTE|COLETIVO|EMPRESA|LTDA|PREFEITURA|SECRETARIA|SEGURANCA|SEGURAN[ÇC]A|ESTADO|MINAS|GERAIS|BRASIL|BARBACENA|IGNORADO|DESCONHECIDA?|INFORMA[ÇC][ÃA]O|APLICA|PRIS[ÃA]O|REGISTRO|OCORR[ÊE]NCIA|NOSSA|SENHORA?|SANTA|SANTO|S[ÃA]O|ACIDENTE|TR[ÂA]NSITO|TRANSITO|V[ÍI]TIMA|VE[ÍI]CULO|DEFEITO|CONDUTOR|PASSAGEIROS?|TESTEMUNHA|ONIBUS|[ÔO]NIBUS|AUTOM[ÓO]VEL|REPASSAD[OA])\b/;

/** a→[aáàâã] etc., so "JOSE PAULO" in the record matches "JOSÉ PAULO" in prose. */
function accentClass(ch: string): string {
  const map: Record<string, string> = {
    A: "[AÁÀÂÃÄ]",
    E: "[EÉÈÊË]",
    I: "[IÍÌÎÏ]",
    O: "[OÓÒÔÕÖ]",
    U: "[UÚÙÛÜ]",
    C: "[CÇ]",
  };
  return map[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function accentInsensitivePattern(words: string[]): RegExp {
  const base = words
    .map((w) =>
      w
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split("")
        .map(accentClass)
        .join(""),
    )
    .join("\\s+");
  return new RegExp(`\\b${base}\\b`, "g");
}

function stripHeader(p: string): string {
  return p.replace(/^##\s*/, "").trim();
}

function isFormLabel(text: string): boolean {
  return FORM_LABELS.some((re) => re.test(text));
}

export interface FormCleanResult {
  /** Final text: distilled fields + people involved + narrative. Nothing else. */
  text: string;
  discardedParagraphs: number;
  foundNarrative: boolean;
}

/**
 * Detects whether the markdown looks like a form (many short headers in a
 * row) — the whitelist profile only makes sense then.
 */
export function looksLikeFormDocument(markdown: string): boolean {
  const paragraphs = markdown.split(/\n\s*\n+/);
  const headers = paragraphs.filter((p) => p.trim().startsWith("## ")).length;
  return paragraphs.length >= 12 && headers / paragraphs.length > 0.4;
}

export function cleanFormDocument(markdown: string): FormCleanResult {
  // Strip empty-field markers ("XXXX") glued to real values.
  const paragraphs = markdown
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\bX{3,}\b/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  // 1) Distilled fields: the value is in a neighbor (looks at i+1, i-1, i+2, i-2).
  const collected = new Map<string, string[]>();
  const addValue = (key: string, value: string, collectAll?: boolean) => {
    const list = collected.get(key) ?? [];
    if (!collectAll && list.length) return;
    if (list.includes(value)) return;
    list.push(value);
    collected.set(key, list);
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const text = stripHeader(paragraphs[i]);
    for (const field of NEWS_FIELDS) {
      if (!field.label.test(text)) continue;
      // Immediate neighbors first; then -2 before +2 (in SISP the orphaned
      // value usually comes BEFORE the label when it doesn't come right after).
      for (const j of [i + 1, i - 1, i - 2, i + 2]) {
        if (j < 0 || j >= paragraphs.length) continue;
        const neighbor = stripHeader(paragraphs[j]);
        if (isFormLabel(neighbor)) continue;
        if (!field.valueLooksLike.test(neighbor)) continue;
        const value = field.extract
          ? (neighbor.match(field.extract)?.[1] ?? neighbor)
          : neighbor;
        addValue(field.key, value, field.collectAll);
        break;
      }
    }
  }

  // 2) Content recognized by pattern, sweeping the whole document — it
  // survives markdownify's dedup of repeated labels.
  for (const p of paragraphs) {
    const text = stripHeader(p);
    const nat = text.match(NATURE_CODE);
    if (nat) addValue("nature", nat[1].trim());
    if (text.length <= 80 && INVOLVEMENT.test(text)) {
      addValue("involvements", text, true);
    }
    if (INJURY.test(text)) addValue("injuries", text, true);
    const birth = text.match(BIRTH_WITH_AGE);
    if (birth) addValue("ages", birth[1], true);
  }

  // 3) Harvest people's names from the records (discarded paragraphs) to
  // clean the narrative afterwards.
  const collectedValues = new Set(
    [...collected.values()].flat().map((v) => v.toUpperCase()),
  );
  const harvestedNames: string[][] = [];
  for (const p of paragraphs) {
    const text = stripHeader(p);
    if (!NAMEISH_PARAGRAPH.test(text)) continue;
    if (isFormLabel(text) || ADDRESSISH_START.test(text)) continue;
    if (INVOLVEMENT.test(text) || INJURY.test(text)) continue;
    if (INSTITUTION_WORDS.test(text)) continue;
    if (collectedValues.has(text.toUpperCase())) continue;
    const words = text.split(/\s+/);
    harvestedNames.push(words);
    // "SR JOSÉ PAULO" in prose vs "JOSE PAULO JUVENCIO" in the record: also
    // register the 2-word prefix.
    if (words.length >= 3) harvestedNames.push(words.slice(0, 2));
  }

  // 4) Narrative: re-join the fragments that became "headers" through the
  // PDF's line wrapping, and stop at the first system section.
  const narrative: string[] = [];
  const NARRATIVE_MAX = 5000;
  outer: for (let i = 0; i < paragraphs.length; i++) {
    if (!NARRATIVE_HEADER_FORM.test(paragraphs[i])) continue;
    for (let j = i + 1; j < paragraphs.length; j++) {
      const raw = paragraphs[j];
      const text = stripHeader(raw);
      if (NARRATIVE_TERMINATOR.test(text)) break outer;
      const isFragment = raw.startsWith("## ");
      if (isFragment && !/[.!?]$/.test(text) && text.length < 60) break outer;
      if (isFragment && narrative.length) {
        // "## POSTE DE ILUMINAÇÃO." continues the previous sentence.
        narrative[narrative.length - 1] += ` ${text}`;
      } else {
        narrative.push(text);
      }
      if (narrative.join(" ").length > NARRATIVE_MAX) break outer;
    }
    break;
  }

  // 5) Remove the harvested names from the narrative (accent-tolerant) —
  // longer names first, so "JOSE PAULO JUVENCIO" beats "JOSE PAULO".
  let narrativeText = narrative.join("\n");
  harvestedNames.sort((a, b) => b.length - a.length);
  for (const words of harvestedNames) {
    narrativeText = narrativeText.replace(
      accentInsensitivePattern(words),
      "[nome removido]",
    );
  }
  narrativeText = narrativeText.replace(
    /\[nome removido\](\s+\[nome removido\])+/g,
    "[nome removido]",
  );

  const summaryOrder: { key: string; display: string }[] = [
    { key: "nature", display: "Natureza da ocorrência" },
    ...NEWS_FIELDS.map(({ key, display }) => ({ key, display })),
    { key: "involvements", display: "Tipos de envolvimento registrados" },
    { key: "injuries", display: "Graus de lesão registrados entre os envolvidos" },
  ];

  const parts: string[] = [];
  const seen = new Set<string>();
  for (const { key, display } of summaryOrder) {
    if (seen.has(key)) continue;
    seen.add(key);
    const values = collected.get(key);
    if (values?.length) parts.push(`${display}: ${values.join("; ")}`);
  }
  if (narrative.length) {
    parts.push(`\nHistórico registrado no BO:\n${narrativeText}`);
  }

  return {
    text: parts.join("\n"),
    discardedParagraphs: paragraphs.length - narrative.length,
    foundNarrative: narrative.length > 0,
  };
}
