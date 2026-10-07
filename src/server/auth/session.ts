import { jwtVerify, SignJWT } from "jose";
import { isRole, type Role } from "@/domain/roles";

/**
 * Stateless session tokens (HS256 JWT) carried in an HttpOnly cookie.
 *
 * This module is intentionally free of database and `server-only` imports so
 * the edge-safe proxy can use it for coarse page redirects. Authoritative
 * checks (API routes, Server Components) additionally re-load the user from
 * the database on every request — see ./current-user.ts.
 */

export const SESSION_COOKIE = "af_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // one factory shift

const ISSUER = "apparelflow-erp";
const AUDIENCE = "apparelflow-web";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SessionClaims {
  userId: string;
  role: Role;
}

let cachedKey: { secret: string; key: Uint8Array } | null = null;

function signingKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  }
  if (cachedKey?.secret !== secret) {
    cachedKey = { secret, key: new TextEncoder().encode(secret) };
  }
  return cachedKey.key;
}

export async function createSessionToken(user: { id: string; role: Role }): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(signingKey());
}

/** Returns the verified claims, or null for a missing, forged, expired or malformed token. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || !UUID_PATTERN.test(payload.sub) || !isRole(payload.role)) {
      return null;
    }
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
