import { hasPermission, type Permission, type Role } from "@/domain/roles";

export type NavIcon = "cutting" | "queue" | "history" | "sewing" | "recipes";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: NavIcon;
  /** Exact match only (otherwise prefix match marks the item active). */
  exact?: boolean;
  permission: Permission;
}

const ALL_ITEMS: NavItem[] = [
  {
    href: "/cutting",
    label: "Cutting Orders",
    description: "Create & track batches",
    icon: "cutting",
    permission: "order:read",
  },
  {
    href: "/verification",
    label: "QC Queue",
    description: "Batches awaiting count",
    icon: "queue",
    exact: true,
    permission: "verification:read",
  },
  {
    href: "/verification/history",
    label: "Decision Log",
    description: "Immutable QC records",
    icon: "history",
    permission: "verification:read",
  },
  {
    href: "/sewing",
    label: "Sewing Queue",
    description: "Verified batches only",
    icon: "sewing",
    permission: "sewing:read",
  },
  {
    href: "/recipes",
    label: "Recipe Library",
    description: "Bills of materials",
    icon: "recipes",
    permission: "recipe:read",
  },
];

/** Navigation is derived from the RBAC matrix, so menus can never drift from server rules. */
export function navigationFor(role: Role): NavItem[] {
  return ALL_ITEMS.filter((item) => hasPermission(role, item.permission));
}

export type PipelineStage = "cutting" | "qc" | "sewing";

export const ROLE_STAGE: Record<Role, PipelineStage> = {
  CUTTING_SUPERVISOR: "cutting",
  CUTTING_VERIFIER: "qc",
  SEWING_SUPERVISOR: "sewing",
};
