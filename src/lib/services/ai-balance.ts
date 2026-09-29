import "server-only";
import { env } from "../env";
import { ApiError } from "../http";

/**
 * Balance of the AI provider's credits, read straight from the OpenRouter API.
 *
 * Only OpenRouter exposes this through an API (Groq, Gemini, OpenAI and
 * Anthropic have no public balance endpoint) — since it is the one carrying
 * the chain today (see buildChain in ai/index.ts), the panel shows the balance
 * whenever OPENROUTER_API_KEY is set, regardless of AI_PROVIDER. Two endpoints:
 *
 *   GET /credits   → total purchased and total spent of the ACCOUNT (all keys)
 *   GET /auth/key  → spend of this KEY (today/week/month) and limit, if any
 *
 * The key is global (env), not per company — so every admin sees the same
 * balance of the installation.
 */
export interface AiBalance {
  provider: "openrouter";
  /** Credits purchased on the account, in USD. */
  totalCredits: number;
  /** Everything the account has already spent, in USD (all keys). */
  totalUsage: number;
  /** totalCredits - totalUsage (never negative). */
  remaining: number;
  /** Consumption of this key only (the one JornAI uses), in USD. */
  key: {
    label: string;
    usage: number;
    usageDaily: number;
    usageWeekly: number;
    usageMonthly: number;
    /** Spend cap configured on the key (null = no cap). */
    limit: number | null;
    limitRemaining: number | null;
    isFreeTier: boolean;
    /** Daily quota of requests to ":free" models (the chain uses one as the 3rd link). */
    freeModelDailyRequests: { used: number; limit: number; remaining: number } | null;
  };
  fetchedAt: string;
}

export type AiBalanceResult =
  | { supported: true; balance: AiBalance; cached: boolean }
  | { supported: false; provider: string };

const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

let cache: { balance: AiBalance; at: number } | null = null;

export async function getAiBalance(opts: { fresh?: boolean } = {}): Promise<AiBalanceResult> {
  if (!env.ai.openrouterKey) {
    return { supported: false, provider: env.ai.provider };
  }

  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { supported: true, balance: cache.balance, cached: true };
  }

  const [credits, key] = await Promise.all([
    openrouterGet<{ total_credits: number; total_usage: number }>("/credits"),
    openrouterGet<OpenRouterKeyInfo>("/auth/key"),
  ]);

  const totalCredits = num(credits.total_credits);
  const totalUsage = num(credits.total_usage);
  const balance: AiBalance = {
    provider: "openrouter",
    totalCredits,
    totalUsage,
    remaining: Math.max(0, totalCredits - totalUsage),
    key: {
      label: key.label ?? "",
      usage: num(key.usage),
      usageDaily: num(key.usage_daily),
      usageWeekly: num(key.usage_weekly),
      usageMonthly: num(key.usage_monthly),
      limit: key.limit ?? null,
      limitRemaining: key.limit_remaining ?? null,
      isFreeTier: Boolean(key.is_free_tier),
      freeModelDailyRequests: key.free_model_daily_requests
        ? {
            used: num(key.free_model_daily_requests.used),
            limit: num(key.free_model_daily_requests.limit),
            remaining: num(key.free_model_daily_requests.remaining),
          }
        : null,
    },
    fetchedAt: new Date().toISOString(),
  };

  cache = { balance, at: Date.now() };
  return { supported: true, balance, cached: false };
}

interface OpenRouterKeyInfo {
  label?: string;
  usage?: number;
  usage_daily?: number;
  usage_weekly?: number;
  usage_monthly?: number;
  limit?: number | null;
  limit_remaining?: number | null;
  is_free_tier?: boolean;
  free_model_daily_requests?: { used: number; limit: number; remaining: number };
}

async function openrouterGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${env.ai.openrouterBaseUrl.replace(/\/$/, "")}${path}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.ai.openrouterKey}` },
      cache: "no-store",
    });
  } catch (err) {
    const why =
      (err as Error).name === "AbortError"
        ? "tempo esgotado"
        : (err as Error).message;
    throw new ApiError(502, `OpenRouter did not answer (${why}).`);
  } finally {
    clearTimeout(timeout);
  }

  const body = (await res.json().catch(() => null)) as
    | { data?: T; error?: { message?: string } }
    | null;
  if (!res.ok || !body?.data) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(502, `OpenRouter refused the balance query: ${msg}`);
  }
  return body.data;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
