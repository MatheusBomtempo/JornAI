import { env } from "../env";
import { prisma } from "../db";
import { AnthropicProvider } from "./anthropic";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { MockProvider } from "./mock";
import { ChainProvider } from "./chain";
import { validateGeneratedContent, violationsToGuidance } from "./validate";
import type { AiProvider, GenerateInput, GeneratedContent } from "./types";

export type { GenerateInput, GeneratedContent } from "./types";

let cached: AiProvider | null = null;

/**
 * Builds the fallback chain from the providers that have a key configured.
 * Order: Groq (fast, tested) -> OpenRouter (2nd link, with the free models
 * that passed the format test). NVIDIA is left out by default — see the
 * comment in env.ts for why.
 */
function buildChain(): AiProvider[] {
  const links: AiProvider[] = [];

  // Short timeout on the free links: a healthy model answers in 1-3s; if it
  // takes longer, the shared free pool is queued or congested — failing fast
  // and falling through to the next link beats waiting up to 25s per call,
  // several times in a row.
  const FREE_TIER_TIMEOUT_MS = 15_000;

  if (env.ai.groqKey) {
    links.push(
      new OpenAICompatibleProvider({
        name: "groq",
        baseUrl: env.ai.groqBaseUrl,
        apiKey: env.ai.groqKey,
        model: env.ai.groqModel,
        timeoutMs: FREE_TIER_TIMEOUT_MS,
      }),
    );
  }

  if (env.ai.openrouterKey) {
    for (const model of env.ai.openrouterModels) {
      links.push(
        new OpenAICompatibleProvider({
          name: `openrouter:${model}`,
          baseUrl: env.ai.openrouterBaseUrl,
          apiKey: env.ai.openrouterKey,
          model,
          timeoutMs: FREE_TIER_TIMEOUT_MS,
          extraHeaders: {
            "HTTP-Referer": env.ai.appUrl,
            "X-Title": "JornAI",
          },
        }),
      );
    }
  }

  if (env.ai.nvidiaKey && env.ai.nvidiaModel) {
    // Only joins if you set NVIDIA_MODEL explicitly — no model was ready for
    // automatic use in testing (see env.ts).
    links.push(
      new OpenAICompatibleProvider({
        name: "nvidia",
        baseUrl: env.ai.nvidiaBaseUrl,
        apiKey: env.ai.nvidiaKey,
        model: env.ai.nvidiaModel,
        timeoutMs: 20_000,
      }),
    );
  }

  if (env.ai.anthropicKey) {
    links.push(new AnthropicProvider());
  }

  return links;
}

/** Factory of the AI provider selected by AI_PROVIDER. */
export function getAiProvider(): AiProvider {
  if (cached) return cached;
  switch (env.ai.provider) {
    case "chain":
      cached = new ChainProvider(buildChain());
      break;
    case "anthropic":
      cached = new AnthropicProvider();
      break;
    case "openrouter":
      cached = new OpenAICompatibleProvider({
        name: "openrouter",
        baseUrl: env.ai.openrouterBaseUrl,
        apiKey: env.ai.openrouterKey ?? "",
        model: env.ai.model,
        extraHeaders: {
          "HTTP-Referer": env.ai.appUrl,
          "X-Title": "JornAI",
        },
      });
      break;
    case "groq":
      cached = new OpenAICompatibleProvider({
        name: "groq",
        baseUrl: env.ai.groqBaseUrl,
        apiKey: env.ai.groqKey ?? "",
        model: env.ai.model,
      });
      break;
    case "gemini":
      cached = new OpenAICompatibleProvider({
        name: "gemini",
        baseUrl: env.ai.geminiBaseUrl,
        apiKey: env.ai.geminiKey ?? "",
        model: env.ai.model,
      });
      break;
    case "nvidia":
      cached = new OpenAICompatibleProvider({
        name: "nvidia",
        baseUrl: env.ai.nvidiaBaseUrl,
        apiKey: env.ai.nvidiaKey ?? "",
        model: env.ai.nvidiaModel ?? env.ai.model,
      });
      break;
    case "openai":
      cached = new OpenAICompatibleProvider({
        name: "openai",
        baseUrl: env.ai.openaiBaseUrl,
        apiKey: env.ai.openaiKey ?? "",
        model: env.ai.model,
      });
      break;
    case "mock":
      cached = new MockProvider();
      break;
    default:
      throw new Error(
        `Unknown AI_PROVIDER: "${env.ai.provider}". Use chain, anthropic, groq, gemini, nvidia, openrouter, openai or mock.`,
      );
  }
  return cached;
}

/**
 * Text generation pipeline of a post. Loads the newspaper's style examples
 * and calls the configured provider.
 *
 * In "chain" mode, resilience already comes from switching PROVIDER when one
 * fails (rate limit, down, etc.) — retrying the whole chain again makes no
 * sense. In single-provider mode, one retry fixes most empty/malformed
 * answers from free models; a rate limit error is the exception (insisting
 * right away does not help).
 */
export async function generatePostContent(
  input: Omit<GenerateInput, "examples">,
): Promise<GeneratedContent> {
  // Few examples, and each caption is clipped in buildUserPrompt — free
  // providers meter tokens per minute and a big prompt can blow the quota alone.
  const examples = await prisma.styleExample.findMany({
    orderBy: { orderIndex: "asc" },
    take: 3,
    select: { title: true, subtitle: true, caption: true },
  });
  const provider = getAiProvider();
  const fullInput = { ...input, examples };

  const first = await generateOnce(provider, fullInput);
  // The mock copies snippets of the source verbatim — validating makes no sense.
  if (provider instanceof MockProvider) return first;

  // Deterministic factual validation (validate.ts): compares the generated
  // text with the source. Violated → ONE regeneration with the fixes as
  // guidance; if it still violates, fail loudly — a clear error for the
  // reporter beats a convincing post with an invented fact.
  const sourceText = [input.text, input.scrapedContent]
    .filter(Boolean)
    .join("\n");
  const violations = validateGeneratedContent(first, sourceText);
  if (!violations.length) return first;

  console.warn(
    `[JornAI] Factual validation rejected the 1st generation (${violations
      .map((v) => v.rule)
      .join("; ")}). Regenerating with corrections.`,
  );
  const corrective = violationsToGuidance(violations);
  const retryInput = {
    ...fullInput,
    guidance: [input.guidance?.trim(), corrective].filter(Boolean).join("\n\n"),
  };
  const second = await generateOnce(provider, retryInput);
  const remaining = validateGeneratedContent(second, sourceText);
  if (!remaining.length) return second;

  throw new Error(
    "The AI kept violating factual-fidelity rules even after correction " +
      `(${remaining.map((v) => v.rule).join("; ")}). ` +
      "Nothing was saved — try generating again or adjust the source.",
  );
}

async function generateOnce(
  provider: AiProvider,
  input: GenerateInput,
): Promise<GeneratedContent> {
  if (provider instanceof ChainProvider) {
    return provider.generate(input);
  }
  try {
    return await provider.generate(input);
  } catch (err) {
    if (isRateLimitError(err)) throw err;
    console.warn(
      `[JornAI] AI (${provider.name}) failed on the 1st attempt, trying again: ${(err as Error).message}`,
    );
    return await provider.generate(input);
  }
}

function isRateLimitError(err: unknown): boolean {
  const msg = (err as Error)?.message?.toLowerCase() ?? "";
  return msg.includes("rate limit") || msg.includes("429") || msg.includes("quota");
}
