/**
 * Centralized, typed access to the environment variables.
 * Keeps sensible defaults for development mode.
 */

import { getContentLanguage } from "./language/config";

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Required environment variable is missing: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  /**
   * Language JornAI works in (APP_LANGUAGE): the language of the sources and
   * of the generated posts. See src/lib/language.
   */
  language: () => getContentLanguage(),

  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",

  databaseUrl: () => required("DATABASE_URL", process.env.DATABASE_URL),

  authSecret: () =>
    required(
      "AUTH_SECRET",
      process.env.AUTH_SECRET ??
        (process.env.NODE_ENV !== "production"
          ? "insecure-dev-secret-change-in-production"
          : undefined),
    ),
  authSessionTtl: () => Number(process.env.AUTH_SESSION_TTL ?? 604800),

  /** Authenticates Vercel Cron on /api/cron/*. Without it, the endpoint is open. */
  cronSecret: process.env.CRON_SECRET,

  ai: {
    provider: (process.env.AI_PROVIDER ?? "anthropic").toLowerCase(),
    model: process.env.AI_MODEL ?? "claude-sonnet-5",
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openrouterKey: process.env.OPENROUTER_API_KEY,
    openrouterBaseUrl:
      process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    groqKey: process.env.GROQ_API_KEY,
    groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
    // Groq model used in the fallback chain (AI_PROVIDER=chain).
    groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    geminiKey: process.env.GEMINI_API_KEY,
    geminiBaseUrl:
      process.env.GEMINI_BASE_URL ??
      "https://generativelanguage.googleapis.com/v1beta/openai",
    // OpenRouter models in the chain, in order of preference (tested and
    // confirmed to follow the prompt format). Comma-separated in .env.
    openrouterModels: (
      process.env.OPENROUTER_MODELS ??
      "nex-agi/nex-n2.5-mini:free,nex-agi/nex-n2.5-pro:free,inclusionai/ling-3.0-flash-vl:free"
    )
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    // NVIDIA NIM — plumbing is ready, but it is left out of the chain by
    // default: we tested 9 catalog models with this key and none proved
    // viable (most return 404 "not enabled for this account"; the ones that
    // answer are slow reasoning models that do not finish the answer within a
    // reasonable time). Enable more models in the NVIDIA dashboard and set
    // NVIDIA_MODEL to turn it back on.
    nvidiaKey: process.env.NVIDIA_API_KEY,
    nvidiaBaseUrl:
      process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    nvidiaModel: process.env.NVIDIA_MODEL,
    // OpenRouter uses these (optional) headers for attribution.
    appUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  },

  storage: {
    provider: (process.env.STORAGE_PROVIDER ?? "local").toLowerCase(),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      publicUrl: process.env.S3_PUBLIC_URL,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    },
  },

  // Built-in photo search in the "Image" step (see ImageSuggestions in
  // PostWorkspace) — lets the reporter pick a stock photo without leaving the
  // site; it arrives already downloaded and ready to become the art.
  // Optional: without the key, the button falls back to opening the Pexels
  // search in a new tab.
  photoSearch: {
    pexelsKey: process.env.PEXELS_API_KEY,
  },

  instagram: {
    userId: process.env.IG_USER_ID,
    accessToken: process.env.IG_ACCESS_TOKEN,
    graphVersion: process.env.IG_GRAPH_VERSION ?? "v21.0",
  },

  // Gmail SMTP: sends to any recipient without needing a verified domain
  // (unlike a transactional provider such as Resend) — Google already vouches
  // for the account itself. Trade-off: it goes out as a personal sender,
  // subject to Gmail's limits and flagging risk.
  // GMAIL_APP_PASSWORD is generated at myaccount.google.com/apppasswords
  // (requires 2-step verification enabled on the account).
  email: {
    gmailUser: process.env.GMAIL_USER,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
  },
};
