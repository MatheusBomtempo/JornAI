import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { env } from "./env";
import { unauthorized } from "./http";
import { getLanguagePack } from "./language";
import {
  SESSION_COOKIE,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";
import type { User } from "@prisma/client";

const BCRYPT_ROUNDS = 10;

// ── Senhas ───────────────────────────────────────────────────
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Session cookie ───────────────────────────────────────────
export async function setSessionCookie(user: User): Promise<void> {
  const token = await signSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: env.authSessionTtl(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Reads the session from the cookie (without touching the database). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Loads the logged-in user from the session + database. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session?.sub) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.active) return null;
  return user;
}

/** Same as getCurrentUser, but throws 401 if there is no user. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/**
 * Same as requireUser, but guarantees companyId is present — every route that
 * reads/writes "environment" data (posts, templates, style, settings, API
 * keys) requires it; a user without a company only exists between login and
 * onboarding (see /onboarding), and none of these routes is reachable in that
 * meantime (the middleware redirects first).
 */
export async function requireCompanyUser(): Promise<User & { companyId: string }> {
  const user = await requireUser();
  if (!user.companyId) throw unauthorized("Register your company before continuing.");
  return user as User & { companyId: string };
}

/**
 * Temporary password for a new login or a reset done by admin/manager (see
 * /users routes) — pattern: a word + 4 digits (e.g. "success5713", the word
 * comes from the language pack), easy to pass on verbally/by email; the person
 * changes it on first access (see /api/auth/change-password). Four digits, not
 * two: with only 100 combinations the login throttle (5 failures / 15 min)
 * would still let anyone guess it within a few hours.
 */
export function generateTempPassword(): string {
  const digits = randomInt(0, 10_000);
  return `${getLanguagePack().tempPasswordWord}${digits.toString().padStart(4, "0")}`;
}

// ── API keys ─────────────────────────────────────────────────
const API_KEY_PREFIX = "jrn_";

/** Generates a new key (shown only once) + its hash to store. */
export function generateApiKey(): { plain: string; hash: string } {
  const plain = API_KEY_PREFIX + randomBytes(24).toString("hex");
  return { plain, hash: hashApiKey(plain) };
}

/** Deterministic hash (SHA-256) for a quick API key lookup. */
export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}
