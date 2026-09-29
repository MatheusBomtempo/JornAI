import { getLanguagePack } from "./language";

/**
 * Classifies the content (already markdownified — see markdownify.ts) as
 * "structured" (police report, expert report, official statement — documents
 * with labelled fields) or "generic" (newspaper article, running text).
 * Purely by text pattern — no AI call, which makes this step free and
 * instant. The patterns are language-specific and live in the language pack.
 */

export type ContentKind = "structured" | "generic";

/** 2+ labelled-field signals = probably an official document. */
export function classifyContent(text: string): ContentKind {
  const hits = getLanguagePack().document.structuredSignals.reduce(
    (n, re) => (re.test(text) ? n + 1 : n),
    0,
  );
  return hits >= 2 ? "structured" : "generic";
}

/**
 * "Label: value" at the start of a whole paragraph — same idea as
 * LOOKS_LIKE_LABELED_LINE in markdownify.ts, but applied to the already
 * reassembled paragraph (which can have several sentences after the label).
 */
const LABELED_PARAGRAPH = /^(\p{L}[\p{L}\p{N}_ ]{0,40})\s*[:\-]\s*(\S[\s\S]*)$/u;

const FIELD_CAP: Record<string, number> = { narrative: 1500 };
const DEFAULT_CAP = 300;

function clipField(key: string, value: string): string {
  const cap = FIELD_CAP[key] ?? DEFAULT_CAP;
  return value.length > cap ? value.slice(0, cap) + "…" : value;
}

/** "nature", "date of incident", "report time" → "nature", "date", "report_time" */
function normalizeKey(label: string, noise: RegExp): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(noise, "")
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * Extracts ALL labelled fields from the markdownified text, paragraph by
 * paragraph — not just a fixed list. A police report has dozens of different
 * layouts ("Presumed cause:", "Victims:", "Vehicles involved:" …); a fixed
 * list of recognized fields silently threw away any label not on it, leaving
 * the AI without real facts to write and forcing it to "fill in" with
 * generalities (that was the real bug that caused invented information in a
 * post).
 *
 * A heuristic, not a guaranteed parser — but by capturing any "Label: value"
 * instead of only the ones we anticipated, the chance of losing a relevant
 * fact drops a lot. The generic (markdownified) text keeps serving as a safety
 * net in compact.ts for the cases outside the pattern.
 */
export interface ExtractedFields {
  fields: Record<string, string>;
  /**
   * Original label (as it appeared in the document) for the fields captured
   * generically — for the known fields, `fieldLabel()` already covers it.
   */
  labels: Record<string, string>;
}

export function extractStructuredFields(markdownText: string): ExtractedFields {
  const doc = getLanguagePack().document;
  const paragraphs = markdownText
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const fields: Record<string, string> = {};
  const labels: Record<string, string> = {};
  const setField = (key: string, value: string, label?: string) => {
    if (fields[key]) return;
    fields[key] = clipField(key, value);
    if (label) labels[key] = label;
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const headerMatch = p.match(/^##\s+(.+)$/);

    if (headerMatch) {
      const headerText = headerMatch[1];
      if (!fields.narrative && doc.narrativeHeader.test(p)) {
        const next = paragraphs[i + 1];
        if (next && !next.startsWith("##")) {
          setField("narrative", next);
        }
      }
      if (!fields.type && doc.docTypeHeader.test(headerText)) {
        setField("type", headerText);
      }
      continue;
    }

    if (!fields.narrative) {
      const m = p.match(doc.narrativeInline);
      if (m?.[1]?.trim()) {
        setField("narrative", m[1].trim());
        continue;
      }
    }
    if (!fields.type && doc.docTypeHeader.test(p)) {
      const m = p.match(doc.docTypeHeader);
      if (m) setField("type", m[0]);
      continue;
    }

    const labeled = p.match(LABELED_PARAGRAPH);
    if (labeled) {
      const key = normalizeKey(labeled[1], doc.labelNoise);
      if (key) setField(key, labeled[2].trim(), labeled[1].trim());
    }
  }

  return { fields, labels };
}

/**
 * Computes the weekday of a date written in text (e.g. "19/08/2026")
 * deterministically — never lets the AI "compute" or guess it (an easy
 * mistake for a language model, and it really showed up in a post: right
 * date, wrong weekday). Date formats and weekday names come from the
 * language pack.
 */
export function weekdayOf(dateStr: string): string | null {
  const pack = getLanguagePack();
  const found = pack.findDates(dateStr)[0];
  return found ? pack.weekdays[found.date.getDay()].name : null;
}

export function fieldLabel(key: string, labels?: Record<string, string>): string {
  const captured = labels?.[key];
  if (captured) return captured.charAt(0).toUpperCase() + captured.slice(1);
  const known = getLanguagePack().document.fieldLabels as Record<string, string>;
  return (
    known[key] ??
    key
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}
