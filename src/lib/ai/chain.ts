import type { AiProvider, GenerateInput, GeneratedContent } from "./types";

function describe(err: unknown): string {
  return (err as Error)?.message ?? String(err);
}

/**
 * Chains several AI providers: tries the first and, if it fails for ANY
 * reason (rate limit, model down, timeout, invalid key...), moves on to the
 * next — each one has its own account and quota, so a whole provider being
 * down does not block post generation.
 *
 * Unlike a retry inside a single provider (which does not help with a rate
 * limit error), switching provider is exactly the right fix here.
 */
export class ChainProvider implements AiProvider {
  readonly name = "chain";
  private links: AiProvider[];

  constructor(links: AiProvider[]) {
    if (links.length === 0) {
      throw new Error(
        "No AI provider configured (check the API keys in .env).",
      );
    }
    this.links = links;
  }

  async generate(input: GenerateInput): Promise<GeneratedContent> {
    const failures: string[] = [];

    for (const provider of this.links) {
      try {
        return await provider.generate(input);
      } catch (err) {
        const msg = describe(err);
        failures.push(`${provider.name}: ${msg}`);
        console.warn(`[JornAI] AI (${provider.name}) failed, trying the next one in the chain: ${msg}`);
      }
    }

    throw new Error(
      `All AI providers failed. Attempts:\n${failures.join("\n")}`,
    );
  }
}
