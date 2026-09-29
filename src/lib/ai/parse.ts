import { TITLE_MAX, SUBTITLE_MAX } from "../render/slots";
import type { GeneratedContent } from "./types";

/**
 * Reads the model's answer. The main format is delimited by markers
 * ([TITLE]/[SUBTITLE]/[CAPTION]) because the caption has several paragraphs —
 * long text with line breaks makes many models produce invalid JSON. JSON is
 * still accepted as an alternative, for compatibility. The markers of the
 * original Portuguese prompt ([TITULO]/[SUBTITULO]/[LEGENDA]) are accepted too.
 */
export function parseGeneratedContent(raw: string): GeneratedContent {
  const cleaned = stripCodeFences(raw).trim();

  const result = parseDelimited(cleaned) ?? parseJson(cleaned);
  if (!result) {
    throw new Error(
      `The AI answered in an unexpected format. Start of the answer: "${cleaned.slice(0, 160)}…"`,
    );
  }

  const { title, subtitle, instagramCaption, imageSuggestions } = result;
  if (!title || !instagramCaption) {
    throw new Error(
      "The AI answer is incomplete (the title or the caption is missing). Try generating again.",
    );
  }

  return {
    // Safety net: the character limit comes from the art layout.
    title: clip(title, TITLE_MAX),
    subtitle: clip(subtitle, SUBTITLE_MAX),
    instagramCaption,
    // Auxiliary — if the AI does not bring it (or brings it wrong), carry on
    // without a suggestion instead of inventing one; it never blocks the post.
    imageSuggestions: imageSuggestions.slice(0, 2),
  };
}

// ── Delimited format (main) ──────────────────────────────────
function parseDelimited(s: string): GeneratedContent | null {
  const re =
    /\[\s*(?:TITLE|T[ÍI]TULO)\s*\]([\s\S]*?)\[\s*(?:SUBTITLE|SUBT[ÍI]TULO)\s*\]([\s\S]*?)\[\s*(?:CAPTION|LEGENDA)\s*\]([\s\S]*?)(?:\[\s*(?:IMAGE[_ ]SUGGESTIONS|SUGEST[ÕO]ES[_ ]IMAGEM)\s*\]([\s\S]*))?$/i;
  const m = s.match(re);
  if (!m) return null;
  return {
    title: clean(m[1]),
    subtitle: clean(m[2]),
    instagramCaption: clean(m[3]),
    imageSuggestions: parseSuggestionLines(m[4] ?? ""),
  };
}

/** Each non-empty line is a suggestion; strips list markers and quotes. */
function parseSuggestionLines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim().replace(/^[-*•\d.)\s]+/, "").replace(/^["']|["']$/g, "").trim())
    .filter(Boolean)
    .slice(0, 2);
}

/** Removes instruction parentheses that some models copy from the template. */
function clean(v: string): string {
  return v
    .trim()
    .replace(/^\((?:máx|max)[^)]*\)\s*/i, "")
    .trim();
}

// ── JSON (alternative) ───────────────────────────────────────
function parseJson(s: string): GeneratedContent | null {
  const jsonText = extractFirstJsonObject(s);
  if (!jsonText) return null;

  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    // Models often leave raw line breaks inside the strings.
    try {
      obj = JSON.parse(escapeRawNewlinesInStrings(jsonText));
    } catch {
      return null;
    }
  }
  if (!obj) return null;

  return {
    title: str(obj.title),
    subtitle: str(obj.subtitle ?? obj.subTitle),
    instagramCaption: str(
      obj.instagramCaption ?? obj.instagram_caption ?? obj.caption,
    ),
    imageSuggestions: strArray(
      obj.imageSuggestions ?? obj.image_suggestions,
    ).slice(0, 2),
  };
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function escapeRawNewlinesInStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString && (ch === "\n" || ch === "\r")) {
      if (ch === "\n") out += "\\n";
      continue;
    }
    out += ch;
  }
  return out;
}

function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s.slice(start); // truncated object — let JSON.parse decide
}

// ── util ─────────────────────────────────────────────────────
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function stripCodeFences(s: string): string {
  return s.replace(/```(?:json|text)?/gi, "").replace(/```/g, "");
}
