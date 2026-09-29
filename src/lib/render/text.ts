import "server-only";
import * as opentypeNS from "opentype.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TextSlot } from "./slots";
import { measure, textToSvg, type Font, type RenderedText, type Weight } from "./text-svg";

/**
 * Server side of the vector text: it only loads Poppins from disk. All the
 * layout (wrapping, shrinking to fit the slot, "…", the position of each
 * glyph) is in text-svg.ts, shared with the browser's art editor — same code
 * + same font file = a preview identical to the final art.
 */

export type { RenderedText } from "./text-svg";

// opentype.js is CommonJS: accepts both default and namespace.
const opentype = (
  (opentypeNS as unknown as { default?: typeof opentypeNS }).default ?? opentypeNS
) as typeof opentypeNS;

const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource", "poppins", "files");

const fontCache = new Map<Weight, Font>();

/** Path of the .woff of a weight — also served to the browser by /api/fonts/poppins/[weight]. */
export function poppinsFile(weight: Weight): string {
  return path.join(FONT_DIR, `poppins-latin-${weight}-normal.woff`);
}

async function loadFont(weight: Weight): Promise<Font> {
  const cached = fontCache.get(weight);
  if (cached) return cached;

  let buf: Buffer;
  try {
    buf = await readFile(poppinsFile(weight));
  } catch {
    throw new Error(
      `Poppins font ${weight} not found. Run "npm install" to restore @fontsource/poppins.`,
    );
  }

  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  fontCache.set(weight, font);
  return font;
}

/**
 * Generates the text paths inside the slot, in absolute canvas coordinates.
 * See textToSvg (text-svg.ts) — the text never exceeds the slot's height.
 */
export async function renderTextToSvg(rawText: string, slot: TextSlot): Promise<RenderedText> {
  if (!rawText.trim()) return { svg: "", height: 0, lines: 0 };
  return textToSvg(await loadFont(slot.weight as Weight), rawText, slot);
}

/** Measures the width of a text (used for validation/preview). */
export async function measureText(text: string, size: number, weight: Weight = 600): Promise<number> {
  return measure(await loadFont(weight), text, size);
}
