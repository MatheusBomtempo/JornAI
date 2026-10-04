import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env";
import type { UserRole } from "./domain";

/**
 * Signing/verification of the session JWT using `jose` — compatible with the
 * Edge Runtime (used in the middleware). It does NOT import bcrypt/Prisma, on
 * purpose.
 */

export const SESSION_COOKIE = "jornai_session";

export interface SessionPayload extends JWTPayload {
  sub: string; // user id
  name: string;
  email: string;
  role: UserRole;
  /** Null until onboarding (see /onboarding) — the middleware uses it to redirect. */
  companyId: string | null;
  /** User.sessionVersion at signing time; absent on sessions older than the field (= 0). */
  ver?: number;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret());
}

export interface SessionInput {
  sub: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  ver: number;
}

export async function signSession(payload: SessionInput): Promise<string> {
  const ttl = env.authSessionTtl();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("jornai")
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey());
}

export async function verifySession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "jornai",
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
