import "server-only";
import { prisma } from "../db";
import { ApiError } from "../http";

/**
 * Brute-force protection for sign-in, backed by the database (not memory):
 * on serverless every instance has its own memory, so an in-memory counter
 * would be trivial to get around by spreading requests.
 *
 * Two limits, both over a sliding window:
 *  - per email: protects one account from password guessing, even when the
 *    attacker rotates IPs;
 *  - per IP: slows down one client trying many accounts (credential stuffing).
 * Only failures count, and a successful sign-in clears the email's failures.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export const TOO_MANY_ATTEMPTS = "Too many sign-in attempts. Try again in a few minutes.";

/** Client IP as seen by the platform (Vercel overwrites these headers, so they can't be spoofed there). */
export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

/** Throws 429 if this email or IP failed too many times recently. Call it BEFORE checking the password. */
export async function assertNotThrottled(email: string, ip: string | null): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { email, createdAt: { gte: since } } }),
    ip ? prisma.loginAttempt.count({ where: { ip, createdAt: { gte: since } } }) : 0,
  ]);
  if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP) {
    throw new ApiError(429, TOO_MANY_ATTEMPTS);
  }
}

export async function recordFailedLogin(email: string, ip: string | null): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ip } });
}

export async function clearFailedLogins(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}

/** Drops old rows — called by the daily cron. */
export async function pruneLoginAttempts(): Promise<number> {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } },
  });
  return count;
}
