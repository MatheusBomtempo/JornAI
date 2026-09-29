/**
 * Turns raw text extracted from a PDF/link into a more readable, compact
 * format, with no AI at all — pure text processing:
 *
 *  1. Removes repeated noise (headers/footers that PDFs repeat on every page —
 *     e.g. the police station name, "Page X of Y").
 *  2. Joins lines broken by the PDF (by page width, not by sentence) back into
 *     running paragraphs.
 *  3. Marks ALL-CAPS lines as section titles ("## NARRATIVE").
 *
 * Serves both the "structured document" path (makes fields easier to find,
 * since each one becomes a single paragraph with no break in the middle) and
 * the "generic" one (when no recognized field shows up, this is already the
 * final result — leaner and more readable than the raw text, instead of just
 * cutting blindly).
 *
 * Nothing here is tied to a language: letter cases use Unicode properties.
 */

/**
 * Detects a section title ("NARRATIVE", "WITNESSES", a police station name).
 *
 * "Is in ALL CAPS" alone is NOT enough: many police reports are typed
 * ENTIRELY in capitals, narrative included — using only that treats every line
 * of the story as a new header and destroys the text (a real bug found in
 * production). What really tells a title from a sentence is the word count: a
 * title is short (few words), a narrative sentence — even in capitals — has
 * many more words chained together.
 */
function looksLikeSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 70) return false;
  if (!/\p{Lu}/u.test(trimmed)) return false;
  if (/\p{Ll}/u.test(trimmed)) return false;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount <= 7;
}

/**
 * "Label: value" at the start of the line (e.g. "Nature:", "ID:", "Date of
 * incident:") — a sign of a NEW field, even without a blank line before it in
 * the original PDF. It is needed because, unlike the end of a sentence (which
 * does NOT mark the end of a paragraph — a multi-sentence story must stay
 * together until the next real blank line), a label always starts something
 * new.
 */
const LOOKS_LIKE_LABELED_LINE = /^\p{L}[\p{L}\p{N}_ ]{0,40}[:\-]\s*\S/u;

export interface MarkdownifyResult {
  text: string;
  removedDuplicateLines: number;
}

export function markdownify(raw: string): MarkdownifyResult {
  const lines = raw.split("\n").map((l) => l.trim());

  // 1) Detect and remove repeated noise (page header/footer): a line that
  // shows up 3+ times in the document is probably not content.
  const counts = new Map<string, number>();
  for (const l of lines) {
    if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const seenNoise = new Set<string>();
  let removedDuplicateLines = 0;
  const deduped: string[] = [];
  for (const l of lines) {
    if (!l) {
      deduped.push("");
      continue;
    }
    const isNoise = (counts.get(l) ?? 0) >= 3 && l.length < 100;
    if (isNoise) {
      if (seenNoise.has(l)) {
        removedDuplicateLines++;
        continue; // already seen — skip the repetition
      }
      seenNoise.add(l); // keep the 1st occurrence, for context
    }
    deduped.push(l);
  }

  // 2) Join broken lines into paragraphs; ALL-CAPS lines become Markdown
  // section headers.
  const paragraphs: string[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer.trim()) paragraphs.push(buffer.trim());
    buffer = "";
  };

  for (const l of deduped) {
    if (!l) {
      flush();
      continue;
    }
    if (looksLikeSectionHeader(l)) {
      flush();
      paragraphs.push(`## ${l}`);
      continue;
    }
    // Only break the paragraph on a real blank line (handled above) or on a
    // new label — NEVER on end-of-sentence punctuation, or a multi-sentence
    // story would be sliced into several loose "paragraphs".
    if (buffer && LOOKS_LIKE_LABELED_LINE.test(l)) flush();
    buffer = buffer ? `${buffer} ${l}` : l;
  }
  flush();

  return {
    text: paragraphs.join("\n\n"),
    removedDuplicateLines,
  };
}
