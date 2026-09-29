import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { buildUserPrompt, buildSystemPrompt } from "./prompt";
import { parseGeneratedContent } from "./parse";
import type { AiProvider, GenerateInput, GeneratedContent } from "./types";

/** Text provider backed by the Anthropic API (Claude). */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor() {
    if (!env.ai.anthropicKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is missing. Set it or use AI_PROVIDER=mock in development.",
      );
    }
    this.client = new Anthropic({ apiKey: env.ai.anthropicKey });
  }

  async generate(input: GenerateInput): Promise<GeneratedContent> {
    const msg = await this.client.messages.create({
      model: env.ai.model,
      // A 3-5 paragraph caption plus credits and hashtags can exceed 1024
      // tokens and get cut mid-sentence — leave some headroom.
      max_tokens: 1600,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return { ...parseGeneratedContent(text), meta: { provider: this.name, model: env.ai.model } };
  }
}
