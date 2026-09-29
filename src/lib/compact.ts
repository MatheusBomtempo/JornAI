import { redactSensitive } from "./redact";
import { markdownify } from "./markdownify";
import {
  classifyContent,
  extractStructuredFields,
  fieldLabel,
} from "./classify";
import { getLanguagePack } from "./language";

/**
 * Content compaction pipeline, running BEFORE the AI:
 *
 *   PDF / URL / TEXT ──▶ (already normalized by pdf.ts/scrape.ts)
 *        │
 *        ▼
 *   MARKDOWNIFY (joins broken lines into paragraphs, removes repeated
 *                header/footer, marks ALL-CAPS sections)
 *        │
 *        ▼
 *   REDACTOR (regex — ID numbers, phones, plates, "Name, NN years") — runs
 *            AFTER markdownify on purpose: a PDF can break a name or phone in
 *            the middle of a line because of page width, and the regex only
 *            matches on the line already reassembled into a paragraph.
 *        │
 *        ▼
 *   CLASSIFIER (structured vs. generic — no AI)
 *        │
 *   ┌────┴────┐
 *   ▼         ▼
 * STRUCTURED GENERIC
 * (extracts   (the markdown
 *  fields)     is already
 *              compact, just
 *              cut at the cap)
 *   └────┬────┘
 *        ▼
 *   COMPACT TEXT ──▶ AI (writing model)
 *
 * Structured document (police report, expert report, official statement):
 * instead of sending the whole 10-20 pages to the AI to "read", only the
 * relevant fields are extracted by rule — no tokens spent on this step, and the
 * result is usually a fraction of the original size.
 *
 * With no recognized field (article from a link, loose text, or any document
 * outside the pattern): the raw text is not cut blindly — the markdownify
 * result (already free of repeated noise, already in real paragraphs) is used
 * and only then is the size cap applied. Generic on purpose: a contract PDF,
 * meeting minutes, anything without recognized fields goes through here and
 * still comes out more readable/compact than the raw text.
 *
 * Which patterns count as "recognized" depends on the content language — see
 * src/lib/language.
 */

// Ceiling of the text that goes on to the prompt. It was 3000 back in the
// free-Groq days (tokens-per-minute cap); with a cheap paid provider that
// became the wrong bottleneck: in a 15-page police report a 3000 cut kept
// ONLY the bureaucratic header and threw away the narrative — the AI invented
// the whole story.
const GENERIC_MAX_CHARS = 8000;

export interface CompactResult {
  kind: "structured" | "generic";
  /** Text ready to go into the AI prompt. */
  text: string;
  originalChars: number;
  compactChars: number;
  redactedCount: number;
  removedDuplicateLines: number;
}

export function compactSource(
  raw: string,
  opts: { keepNames?: boolean } = {},
): CompactResult {
  const pack = getLanguagePack();
  const trimmed = raw.trim();
  const { text: joined, removedDuplicateLines } = markdownify(trimmed);
  const { text: markdown, redactedCount } = redactSensitive(joined, opts);
  const kind = classifyContent(markdown);

  let compactText: string;
  const form = pack.document.form;
  if (kind === "structured" && form?.looksLikeForm(markdown)) {
    // FORM (police report etc.): cells become loose headers and the value
    // floats in the neighbor — the "Label: value" extractor finds nothing
    // here. The form profile removes personal data + bureaucracy, distills the
    // newsworthy fields and brings the narrative to the front of the text.
    // Whitelist: the mass discard of the form does not count as "redaction"
    // in the log — redactedCount keeps measuring only sensitive-data patterns.
    compactText = clip(form.clean(markdown).text, GENERIC_MAX_CHARS);
  } else if (kind === "structured") {
    const { fields, labels } = extractStructuredFields(markdown);
    const lines = Object.entries(fields)
      .filter(([, v]) => v)
      .map(([key, value]) => `${fieldLabel(key, labels)}: ${value}`);
    // Does not trust the fields alone if no substantial content came out —
    // without this the AI is left with just "Nature: X" and no fact to write
    // (real bug: a whole narrative in ALL CAPS could be mis-detected as
    // several headers, emptying the extraction). A long narrative is enough;
    // without one, several labelled fields with real content are also
    // accepted (e.g. a report that spreads the facts over "Victims:",
    // "Vehicles:", "Presumed cause:" instead of a single narrative paragraph).
    // With neither, it falls back to the whole markdown, which always has the
    // real content.
    const totalFieldChars = Object.values(fields).reduce((n, v) => n + v.length, 0);
    const hasSubstance =
      (fields.narrative?.length ?? 0) > 60 ||
      (Object.keys(fields).length >= 4 && totalFieldChars > 150);
    compactText = hasSubstance ? lines.join("\n") : clip(markdown, GENERIC_MAX_CHARS);
  } else {
    compactText = clip(markdown, GENERIC_MAX_CHARS);
  }

  // Last safety net: if the result came out too short next to a substantial
  // original, something went wrong in the compaction — use the original text
  // (only redacted) cut at the cap instead of sending almost nothing to the AI.
  if (compactText.trim().length < 80 && trimmed.length > 300) {
    compactText = clip(markdown, GENERIC_MAX_CHARS);
  }

  // Weekday computed by code from the dates in the text — NEVER left for the
  // model to "compute" (it really got it wrong: right date, wrong weekday).
  const weekdayLine = computedWeekdayLine(compactText);
  if (weekdayLine) compactText += `\n${weekdayLine}`;

  return {
    kind,
    text: compactText,
    originalChars: trimmed.length,
    compactChars: compactText.length,
    redactedCount,
    removedDuplicateLines,
  };
}

/** "Day of the week for 19/08/2026: Wednesday" for the most-cited date in the text. */
function computedWeekdayLine(text: string): string | null {
  const pack = getLanguagePack();
  const counts = new Map<string, { count: number; date: Date }>();
  for (const { raw, date } of pack.findDates(text)) {
    const entry = counts.get(raw);
    counts.set(raw, { count: (entry?.count ?? 0) + 1, date });
  }
  let best: { raw: string; count: number; date: Date } | null = null;
  for (const [raw, { count, date }] of counts) {
    if (!best || count > best.count) best = { raw, count, date };
  }
  if (!best) return null;
  return pack.weekdayLine(best.raw, pack.weekdays[best.date.getDay()].name);
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
