import "server-only";
import { forbidden, redirect } from "next/navigation";
import { hasPermission, type Permission } from "@/domain/roles";
import { getCurrentUser, type AuthUser } from "./current-user";

/** Server Components: the signed-in user, or a redirect to the login page. */
export async function requirePageUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Server Components: the signed-in user holding `permission`. A user in the
 * wrong workspace gets a real HTTP 403 page (app/forbidden.tsx), not a
 * silently hidden tab.
 */
export async function requirePagePermission(permission: Permission): Promise<AuthUser> {
  const user = await requirePageUser();
  if (!hasPermission(user.role, permission)) forbidden();
  return user;
}
