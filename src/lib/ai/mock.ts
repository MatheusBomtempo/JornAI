import { formatCredit } from "../domain";
import { getLanguagePack } from "../language";
import { TITLE_MAX, SUBTITLE_MAX } from "../render/slots";
import type { AiProvider, GenerateInput, GeneratedContent } from "./types";

/**
 * Development provider — calls no external API. Handy for running the whole
 * flow without any AI key configured. Its canned copy follows APP_LANGUAGE.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock";

  async generate(input: GenerateInput): Promise<GeneratedContent> {
    const copy = getLanguagePack().mock;
    const base =
      input.text?.trim() ||
      input.scrapedContent?.trim() ||
      input.sourceUrl ||
      copy.fallbackHeadline;
    const snippet = capitalize(base.split(/\s+/).slice(0, 10).join(" "));

    const credits = (input.credits ?? []).map(formatCredit).filter(Boolean);

    return {
      title: snippet.slice(0, TITLE_MAX),
      subtitle: copy.subtitle.slice(0, SUBTITLE_MAX),
      instagramCaption: [
        snippet + ".",
        "",
        copy.captionNotice,
        ...(credits.length ? ["", ...credits] : []),
        "",
        "#JornAI #Test",
      ].join("\n"),
      imageSuggestions: [...copy.imageSuggestions],
      meta: { provider: this.name, model: "mock" },
    };
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
