import "server-only";
import * as cheerio from "cheerio";
import { readTextLimited, safeFetch } from "./safe-fetch";

/** HTML past this is not an article page — and buffering it whole would be a memory hazard. */
const MAX_HTML_BYTES = 5 * 1024 * 1024;

/**
 * Extracts the title + main text of a link (source_type = 'link'), to serve
 * as the factual source of the AI pipeline. Simple heuristic: removes
 * scripts/styles/nav and concatenates paragraphs.
 */
export async function scrapeUrl(url: string): Promise<{
  title: string;
  content: string;
}> {
  // The URL comes from the reporter — safeFetch blocks private addresses (SSRF).
  const res = await safeFetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JornAI/0.1; +https://github.com/)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Could not access the link (HTTP ${res.status}).`);
  }

  const html = await readTextLimited(res, MAX_HTML_BYTES);
  const $ = cheerio.load(html);

  $("script, style, noscript, nav, header, footer, aside, form").remove();

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    "";

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    "";

  const paragraphs: string[] = [];
  $("article p, main p, p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 40) paragraphs.push(text);
  });

  // Dedup preserving order, and cut at ~10k chars.
  const seen = new Set<string>();
  const body = paragraphs
    .filter((p) => (seen.has(p) ? false : (seen.add(p), true)))
    .join("\n\n")
    .slice(0, 10000);

  const content = [description, body].filter(Boolean).join("\n\n");

  if (!content.trim()) {
    throw new Error(
      "Could not extract text from the link (empty or protected page).",
    );
  }

  return { title, content };
}
