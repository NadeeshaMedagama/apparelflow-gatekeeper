import { describe, expect, it } from "vitest";
import { canAccessPath, hasPermission, PERMISSIONS, ROLES, type Permission, type Role } from "@/domain/roles";
import { canPerform, isOrderEditable, ORDER_ACTIONS, resolveTransition, TRANSITIONS } from "@/domain/state-machine";
import { ORDER_STATUSES } from "@/domain/order-status";

describe("manufacturing state machine", () => {
  it("whitelists exactly the pipeline from the brief", () => {
    const allowed = ORDER_STATUSES.flatMap((status) =>
      ORDER_ACTIONS.filter((action) => canPerform(status, action)).map((action) => `${status} --${action}--> ${TRANSITIONS[action].to}`),
    );
    expect(allowed.sort()).toEqual(
      [
        "CUTTING_IN_PROGRESS --SUBMIT_FOR_VERIFICATION--> PENDING_VERIFICATION",
        "PENDING_VERIFICATION --APPROVE--> VERIFIED",
        "PENDING_VERIFICATION --REJECT--> REJECTED",
        "REJECTED --START_RECUT--> CUTTING_IN_PROGRESS",
        "VERIFIED --START_SEWING--> SEWING_IN_PROGRESS",
      ].sort(),
    );
  });

  it("explains why an illegal transition is refused", () => {
    const result = resolveTransition("REJECTED", "APPROVE");
    expect(result).toMatchObject({ allowed: false, requiredFrom: "PENDING_VERIFICATION" });
  });

  it("only lets batch details change on the cutting table", () => {
    expect(ORDER_STATUSES.filter(isOrderEditable)).toEqual(["CUTTING_IN_PROGRESS"]);
  });
});

describe("RBAC matrix", () => {
  const matrix: Record<Role, Permission[]> = {
    CUTTING_SUPERVISOR: ["recipe:read", "order:create", "order:read", "order:update", "order:submit", "order:recut"],
    CUTTING_VERIFIER: ["recipe:read", "verification:read", "verification:count", "verification:decide"],
    SEWING_SUPERVISOR: ["recipe:read", "sewing:read", "sewing:start"],
  };

  it.each(ROLES)("grants %s exactly its documented permissions", (role) => {
    expect(PERMISSIONS.filter((permission) => hasPermission(role, permission))).toEqual(matrix[role]);
  });

  it("enforces separation of duties", () => {
    expect(hasPermission("CUTTING_SUPERVISOR", "verification:decide")).toBe(false);
    expect(hasPermission("CUTTING_VERIFIER", "order:create")).toBe(false);
    expect(hasPermission("SEWING_SUPERVISOR", "verification:read")).toBe(false);
    expect(hasPermission("SEWING_SUPERVISOR", "order:read")).toBe(false);
  });

  it("maps every transition to the role allowed to trigger it", () => {
    const actors = Object.fromEntries(
      ORDER_ACTIONS.map((action) => [action, ROLES.filter((role) => hasPermission(role, TRANSITIONS[action].permission))]),
    );
    expect(actors).toEqual({
      SUBMIT_FOR_VERIFICATION: ["CUTTING_SUPERVISOR"],
      APPROVE: ["CUTTING_VERIFIER"],
      REJECT: ["CUTTING_VERIFIER"],
      START_RECUT: ["CUTTING_SUPERVISOR"],
      START_SEWING: ["SEWING_SUPERVISOR"],
    });
  });

  it("guards workspace paths by role", () => {
    expect(canAccessPath("CUTTING_SUPERVISOR", "/cutting/orders/123")).toBe(true);
    expect(canAccessPath("CUTTING_SUPERVISOR", "/sewing")).toBe(false);
    expect(canAccessPath("CUTTING_VERIFIER", "/cutting")).toBe(false);
    expect(canAccessPath("SEWING_SUPERVISOR", "/verification/abc")).toBe(false);
    expect(canAccessPath("SEWING_SUPERVISOR", "/recipes")).toBe(true);
    expect(canAccessPath("SEWING_SUPERVISOR", "/sewingfloor")).toBe(true); // unrelated prefix is not the /sewing workspace
  });
});
