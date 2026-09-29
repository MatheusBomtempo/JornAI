import "server-only";

/**
 * Text extraction from a PDF (police report, official statement, article).
 *
 * The pdf.js used by `unpdf` depends on `Promise.withResolvers`, which only
 * exists from Node 22 on. Since the project supports Node 20, we apply the
 * polyfill before loading the library. On Node 22+ this is a no-op.
 */
if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== "function") {
  (Promise as unknown as { withResolvers: unknown }).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/**
 * Ceiling of characters extracted from the document. This is NOT the text that
 * goes to the AI — the compaction (compact.ts) still filters/reduces
 * afterwards. It has to be generous: a real 15-page police report has the
 * narrative (the part that matters) at the very end, and a tight ceiling here
 * cut the story before the cleanup.
 */
export const MAX_DOC_CHARS = 60000;

export interface ExtractedDocument {
  text: string;
  pages: number;
  truncated: boolean;
}

export async function extractPdfText(
  buffer: Buffer,
): Promise<ExtractedDocument> {
  const { extractText, getDocumentProxy } = await import("unpdf");

  let doc;
  try {
    doc = await getDocumentProxy(new Uint8Array(buffer));
  } catch {
    throw new Error(
      "Could not read the PDF (corrupted or password-protected file).",
    );
  }

  const { text, totalPages } = await extractText(doc, { mergePages: true });
  const normalized = normalize(Array.isArray(text) ? text.join("\n") : text);

  if (!normalized) {
    throw new Error(
      "The PDF has no selectable text — it is probably a scanned document (image). Copy the text manually.",
    );
  }

  return {
    text: normalized.slice(0, MAX_DOC_CHARS),
    pages: totalPages,
    truncated: normalized.length > MAX_DOC_CHARS,
  };
}

/** Plain text (.txt) — same normalization. */
export function extractPlainText(buffer: Buffer): ExtractedDocument {
  const normalized = normalize(buffer.toString("utf8"));
  if (!normalized) throw new Error("The file is empty.");
  return {
    text: normalized.slice(0, MAX_DOC_CHARS),
    pages: 1,
    truncated: normalized.length > MAX_DOC_CHARS,
  };
}

function normalize(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
