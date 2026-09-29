import type * as opentypeNS from "opentype.js";
import { applyTransform, type TextSlot } from "./slots";

/**
 * Text layout with Poppins converted to VECTORS (SVG paths) — isomorphic: the
 * SAME code runs in the server render (final art, video) and in the browser's
 * art editor. Only what loads the font file changes (fs on the server, fetch
 * in the browser — the same .woff from @fontsource). That is what guarantees
 * the editor preview is identical to the review art: before, the editor used
 * Fabric's text, with its own metrics and without shrinking the font — a long
 * title wrapped to 3 lines and touched the subtitle, which never happens in
 * the final art (see fitToSlot).
 *
 * Why vectors instead of <text font-family="Poppins">: Sharp renders SVG via
 * librsvg, which only sees fonts installed in the operating system.
 *
 * Each glyph is drawn ONCE at the origin and positioned by `transform`. That
 * is not just an optimization: calling `getPath()` repeatedly on the same
 * glyph makes opentype.js return NaN coordinates from the second occurrence
 * on, and a NaN in the `d` attribute makes librsvg stop drawing mid-sentence.
 */

export type Font = ReturnType<typeof opentypeNS.parse>;
type Glyph = ReturnType<Font["charToGlyph"]>;
export type Weight = 400 | 600 | 700;

/** path data por glifo+tamanho: "400:24:86" -> "M6.5 0.2Q…" */
const glyphCache = new Map<string, string>();

function glyphPathData(glyph: Glyph, weight: Weight, size: number): string {
  const key = `${weight}:${size}:${glyph.index}`;
  const hit = glyphCache.get(key);
  if (hit !== undefined) return hit;

  let d = "";
  try {
    d = glyph.getPath(0, 0, size).toPathData(2);
  } catch {
    d = "";
  }
  // Extra defense: never let NaN reach the SVG.
  if (d.includes("NaN")) d = "";
  glyphCache.set(key, d);
  return d;
}

/** Advance of a glyph in px, with the kerning of the previous pair. */
function advanceOf(font: Font, glyph: Glyph, prev: Glyph | null, size: number): number {
  const scale = size / font.unitsPerEm;
  let adv = (glyph.advanceWidth ?? 0) * scale;
  if (prev) {
    const k = font.getKerningValue(prev, glyph);
    if (Number.isFinite(k)) adv += k * scale;
  }
  return Number.isFinite(adv) ? adv : 0;
}

export function measure(font: Font, text: string, size: number): number {
  const glyphs = font.stringToGlyphs(text);
  let w = 0;
  let prev: Glyph | null = null;
  for (const g of glyphs) {
    w += advanceOf(font, g, prev, size);
    prev = g;
  }
  return w;
}

/** Wraps using the real glyph widths (not by letter count). */
function wrap(font: Font, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(font, candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Appends "…" to the end of the line, removing words (or letters, if needed)
 * until it fits the available width. Different from a plain cut by width: it
 * is used when WHOLE LINES were dropped for lack of height, so the "…" must
 * always show up — even if the line itself already fit — so the reader
 * notices the text was cut, instead of silently vanishing.
 */
function withEllipsis(font: Font, line: string, size: number, maxWidth: number): string {
  if (measure(font, `${line}…`, size) <= maxWidth) return `${line}…`;

  const words = line.split(/\s+/).filter(Boolean);
  while (words.length > 1) {
    words.pop();
    const candidate = `${words.join(" ")}…`;
    if (measure(font, candidate, size) <= maxWidth) return candidate;
  }
  // A single word bigger than the space: cut letter by letter.
  let s = words[0] ?? line;
  while (s.length > 1 && measure(font, `${s}…`, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

const MIN_FIT_SCALE = 0.55; // never shrinks below 55% of the configured size
const SHRINK_STEP = 0.94;

/**
 * Fits the text inside the slot's height: first tries shrinking the font (down
 * to MIN_FIT_SCALE), then — if it still does not fit — cuts lines and
 * ellipsizes the last visible one. It guarantees the text NEVER exceeds the
 * slot's own height, i.e. title and subtitle never collide with each other,
 * even with text much longer than expected.
 */
function fitToSlot(
  font: Font,
  text: string,
  slot: Pick<TextSlot, "fontSize" | "width" | "height" | "lineHeight">,
): { lines: string[]; fontSize: number; lineHeight: number } {
  let fontSize = slot.fontSize;
  const minSize = slot.fontSize * MIN_FIT_SCALE;
  let lines = wrap(font, text, fontSize, slot.width);
  let lineHeight = fontSize * slot.lineHeight;

  while (lines.length * lineHeight > slot.height && fontSize > minSize) {
    fontSize = Math.max(minSize, Math.round(fontSize * SHRINK_STEP * 100) / 100);
    lines = wrap(font, text, fontSize, slot.width);
    lineHeight = fontSize * slot.lineHeight;
  }

  const maxLines = Math.max(1, Math.floor(slot.height / lineHeight));
  if (lines.length > maxLines) {
    // Dropping lines without warning is worse than just shrinking the font: the
    // reader loses part of the sentence without noticing. The "…" signals the cut.
    lines = lines.slice(0, maxLines);
    const last = maxLines - 1;
    lines[last] = withEllipsis(font, lines[last], fontSize, slot.width);
  }

  return { lines, fontSize, lineHeight };
}

export interface RenderedText {
  /** SVG content (one <path> per glyph) already positioned on the canvas. */
  svg: string;
  height: number;
  lines: number;
}

/** A glyph ready to draw: path at the origin + where it goes (already rounded). */
export interface PlacedGlyph {
  d: string;
  x: number;
  y: number;
}

export interface TextLayout {
  glyphs: PlacedGlyph[];
  height: number;
  lines: number;
}

/**
 * Positions every glyph of the text inside the slot, in absolute canvas
 * coordinates. The text is anchored at the TOP of the slot and grows
 * downwards, but NEVER exceeds `slot.height` — see `fitToSlot`. That
 * guarantees title and subtitle, each bound to its own box, never overlap, no
 * matter the size of the text. x/y come out rounded to 2 decimals — the same
 * numbers that go to the server's SVG, so the editor draws in the same place.
 */
export function layoutText(font: Font, rawText: string, slot: TextSlot): TextLayout {
  const text = applyTransform(rawText.trim(), slot.transform);
  if (!text) return { glyphs: [], height: 0, lines: 0 };

  const weight = slot.weight as Weight;
  const { lines, fontSize, lineHeight } = fitToSlot(font, text, slot);
  const ascender = (font.ascender / font.unitsPerEm) * fontSize;

  const glyphs: PlacedGlyph[] = [];

  lines.forEach((line, i) => {
    const lineWidth = measure(font, line, fontSize);
    let x =
      slot.align === "center"
        ? slot.x + (slot.width - lineWidth) / 2
        : slot.align === "right"
          ? slot.x + slot.width - lineWidth
          : slot.x;
    const y = slot.y + ascender + i * lineHeight;

    let prev: Glyph | null = null;
    for (const glyph of font.stringToGlyphs(line)) {
      if (prev) {
        const k = font.getKerningValue(prev, glyph);
        if (Number.isFinite(k)) x += k * (fontSize / font.unitsPerEm);
      }
      const d = glyphPathData(glyph, weight, fontSize);
      if (d.length > 2) {
        glyphs.push({ d, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
      }
      x += (glyph.advanceWidth ?? 0) * (fontSize / font.unitsPerEm);
      prev = glyph;
    }
  });

  if (!glyphs.length) return { glyphs: [], height: 0, lines: 0 };
  return {
    glyphs,
    height: (lines.length - 1) * lineHeight + fontSize * slot.lineHeight,
    lines: lines.length,
  };
}

/** The same layout as SVG — what Sharp (server) draws. */
export function textToSvg(font: Font, rawText: string, slot: TextSlot): RenderedText {
  const { glyphs, height, lines } = layoutText(font, rawText, slot);
  if (!glyphs.length) return { svg: "", height: 0, lines: 0 };

  const parts = glyphs.map((g) => `<path d="${g.d}" transform="translate(${g.x.toFixed(2)} ${g.y.toFixed(2)})"/>`);
  // A single <g> with the color avoids repeating the fill on every glyph.
  return { svg: `<g fill="${slot.color}">${parts.join("")}</g>`, height, lines };
}
