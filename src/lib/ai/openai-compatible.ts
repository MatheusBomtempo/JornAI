import { buildUserPrompt, buildSystemPrompt } from "./prompt";
import { parseGeneratedContent } from "./parse";
import type { AiProvider, GenerateInput, GeneratedContent } from "./types";

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string; // e.g. https://openrouter.ai/api/v1
  apiKey: string;
  model: string;
  /** Extra headers (OpenRouter recommends HTTP-Referer and X-Title). */
  extraHeaders?: Record<string, string>;
  /**
   * Call timeout in ms (default 25s). Important when this provider is part of
   * a fallback chain: some "reasoning" models (e.g. gpt-oss, glm) can take
   * minutes or never finish — without a timeout they would stall the whole
   * chain instead of handing over to the next provider.
   */
  timeoutMs?: number;
}

/**
 * Text provider for any API compatible with the OpenAI chat completions
 * format — including OpenRouter, OpenAI and most gateways. The parser
 * tolerates format variations in the model's answer.
 */
export class OpenAICompatibleProvider implements AiProvider {
  readonly name: string;
  private cfg: OpenAICompatibleConfig;

  constructor(cfg: OpenAICompatibleConfig) {
    if (!cfg.apiKey) {
      throw new Error(
        `${cfg.name}: API key is missing. Set the matching environment variable.`,
      );
    }
    this.name = cfg.name;
    this.cfg = cfg;
  }

  async generate(input: GenerateInput): Promise<GeneratedContent> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.cfg.timeoutMs ?? 25_000,
    );

    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          "Content-Type": "application/json",
          ...this.cfg.extraHeaders,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          temperature: 0.4,
          // A 3-5 paragraph caption plus credits and hashtags can exceed 1024
          // tokens and get cut mid-sentence — leave some headroom.
          max_tokens: 1600,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserPrompt(input) },
          ],
        }),
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error(`${this.cfg.name}: timed out (the model took too long to answer).`);
      }
      throw new Error(`${this.cfg.name}: connection failed (${(err as Error).message}).`);
    } finally {
      clearTimeout(timeout);
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (data as { error?: { message?: string } })?.error?.message ??
        `HTTP ${res.status}`;
      throw new Error(`${this.cfg.name}: ${msg}`);
    }

    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      // Some "reasoning" models only fill reasoning_content and leave content
      // empty/null — no usable final answer.
      throw new Error(`${this.cfg.name}: response has no text content.`);
    }
    return {
      ...parseGeneratedContent(content),
      meta: { provider: this.name, model: this.cfg.model },
    };
  }
}
