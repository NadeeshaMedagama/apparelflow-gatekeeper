import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { cache } from "react";
import { hasPermission, ROLE_PROFILES, type Permission, type Role } from "@/domain/roles";
import { getPrisma } from "@/server/db";
import { ForbiddenError, UnauthorizedError } from "@/server/http/errors";
import { SESSION_COOKIE, verifySessionToken, type SessionClaims } from "./session";

/**
 * The authenticated actor. Every service receives one of these and derives
 * identity (e.g. the verifier recorded on an audit log) exclusively from it —
 * never from request bodies.
 */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

/**
 * Re-loads the user on every request so a deleted account or a changed role
 * invalidates outstanding tokens immediately.
 */
async function resolveUser(claims: SessionClaims | null): Promise<AuthUser | null> {
  if (!claims) return null;
  const user = await getPrisma().user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, fullName: true, role: true },
  });
  if (!user || user.role !== claims.role) return null;
  return user;
}

/** Route Handlers: resolves the caller or throws 401. */
export async function authenticateRequest(request: NextRequest): Promise<AuthUser> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw new UnauthorizedError();
  const user = await resolveUser(await verifySessionToken(token));
  if (!user) throw new UnauthorizedError("Your session is invalid or has expired. Sign in again.");
  return user;
}

/** Server Components: the signed-in user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  return resolveUser(await verifySessionToken(store.get(SESSION_COOKIE)?.value));
});

export function assertPermission(user: AuthUser, permission: Permission): void {
  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError(
      `Your role (${ROLE_PROFILES[user.role].code}) is not permitted to perform this action.`,
      { role: user.role, requiredPermission: permission },
    );
  }
}

/** Route Handlers: authenticate (401) then authorize (403) before any input is parsed. */
export async function requirePermission(request: NextRequest, permission: Permission): Promise<AuthUser> {
  const user = await authenticateRequest(request);
  assertPermission(user, permission);
  return user;
}
