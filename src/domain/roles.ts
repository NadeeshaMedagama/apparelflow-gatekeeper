/**
 * Factory personas and the role-based access control (RBAC) matrix.
 *
 * This module is the single source of truth for "who may do what". It is pure
 * data so the same rules drive server-side enforcement (API + server
 * components) and client-side affordances (navigation, button visibility).
 * Only the server-side checks are a security boundary.
 */

export const ROLES = ["CUTTING_SUPERVISOR", "CUTTING_VERIFIER", "SEWING_SUPERVISOR"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "recipe:read",
  "order:create",
  "order:read",
  "order:update",
  "order:submit",
  "order:recut",
  "verification:read",
  "verification:count",
  "verification:decide",
  "sewing:read",
  "sewing:start",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  // Separation of duties: the supervisor prepares batches but can never verify
  // them, and has no access to the sewing floor.
  CUTTING_SUPERVISOR: new Set<Permission>([
    "recipe:read",
    "order:create",
    "order:read",
    "order:update",
    "order:submit",
    "order:recut",
  ]),
  // Isolated QC checkpoint: counts, approves or rejects. Cannot create orders,
  // edit recipes or reach the sewing queue.
  CUTTING_VERIFIER: new Set<Permission>([
    "recipe:read",
    "verification:read",
    "verification:count",
    "verification:decide",
  ]),
  // Assembly floor: only ever sees batches that passed verification.
  SEWING_SUPERVISOR: new Set<Permission>(["recipe:read", "sewing:read", "sewing:start"]),
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export interface RoleProfile {
  label: string;
  /** Role identifier exactly as written in the assessment brief. */
  code: string;
  summary: string;
  restriction: string;
  home: string;
}

export const ROLE_PROFILES: Record<Role, RoleProfile> = {
  CUTTING_SUPERVISOR: {
    label: "Cutting Supervisor",
    code: "cutting_supervisor",
    summary: "Creates cutting orders from recipes, sets batch quantities, logs fabric yards and tracks cutting progress.",
    restriction: "Cannot verify batches (separation of duties) or access the Sewing Queue.",
    home: "/cutting",
  },
  CUTTING_VERIFIER: {
    label: "Cutting Verifier",
    code: "cutting_verifier",
    summary: "Isolated QC checkpoint. Counts physical parts per recipe, triggers traffic lights and approves or rejects batches.",
    restriction: "Cannot create cutting orders, edit recipes or access the Sewing Queue.",
    home: "/verification",
  },
  SEWING_SUPERVISOR: {
    label: "Sewing Supervisor",
    code: "sewing_supervisor",
    summary: "Receives verified batches on the assembly floor, reviews verifier audit notes and initiates sewing.",
    restriction: "Strictly blocked from unverified, pending or rejected cutting orders.",
    home: "/sewing",
  },
};

/** Page-level workspace guards. Each prefix requires one permission. */
export const WORKSPACE_ACCESS: ReadonlyArray<{ prefix: string; permission: Permission }> = [
  { prefix: "/cutting", permission: "order:read" },
  { prefix: "/verification", permission: "verification:read" },
  { prefix: "/sewing", permission: "sewing:read" },
  { prefix: "/recipes", permission: "recipe:read" },
];

export function requiredPermissionForPath(pathname: string): Permission | null {
  const match = WORKSPACE_ACCESS.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.permission ?? null;
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const permission = requiredPermissionForPath(pathname);
  return permission === null || hasPermission(role, permission);
}
