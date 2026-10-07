import type { OrderStatus } from "./order-status";
import type { Permission } from "./roles";

/**
 * Manufacturing state machine.
 *
 *   CUTTING_IN_PROGRESS ──submit──▶ PENDING_VERIFICATION ──approve──▶ VERIFIED ──start──▶ SEWING_IN_PROGRESS
 *            ▲                              │
 *            └──────── start re-cut ── REJECTED ◀──reject (mandatory reason)
 *
 * Status is never written directly by clients. Every change goes through one
 * named action; the action decides the target status. The same whitelist is
 * mirrored by the `enforce_cutting_order_state_machine` database trigger.
 */
export const ORDER_ACTIONS = [
  "SUBMIT_FOR_VERIFICATION",
  "APPROVE",
  "REJECT",
  "START_RECUT",
  "START_SEWING",
] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

export interface TransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  permission: Permission;
  label: string;
}

export const TRANSITIONS: Readonly<Record<OrderAction, TransitionRule>> = {
  SUBMIT_FOR_VERIFICATION: {
    from: "CUTTING_IN_PROGRESS",
    to: "PENDING_VERIFICATION",
    permission: "order:submit",
    label: "Submit for verification",
  },
  APPROVE: {
    from: "PENDING_VERIFICATION",
    to: "VERIFIED",
    permission: "verification:decide",
    label: "Approve batch",
  },
  REJECT: {
    from: "PENDING_VERIFICATION",
    to: "REJECTED",
    permission: "verification:decide",
    label: "Reject batch",
  },
  START_RECUT: {
    from: "REJECTED",
    to: "CUTTING_IN_PROGRESS",
    permission: "order:recut",
    label: "Start re-cut",
  },
  START_SEWING: {
    from: "VERIFIED",
    to: "SEWING_IN_PROGRESS",
    permission: "sewing:start",
    label: "Start sewing assembly",
  },
};

export type TransitionResult =
  | { allowed: true; from: OrderStatus; to: OrderStatus }
  | { allowed: false; from: OrderStatus; requiredFrom: OrderStatus; reason: string };

export function resolveTransition(current: OrderStatus, action: OrderAction): TransitionResult {
  const rule = TRANSITIONS[action];
  if (current !== rule.from) {
    return {
      allowed: false,
      from: current,
      requiredFrom: rule.from,
      reason: `"${rule.label}" is only allowed from ${rule.from}; the order is currently ${current}.`,
    };
  }
  return { allowed: true, from: current, to: rule.to };
}

export function canPerform(current: OrderStatus, action: OrderAction): boolean {
  return TRANSITIONS[action].from === current;
}

/** Order details (quantity, fabric) are only editable while the batch is being cut. */
export function isOrderEditable(status: OrderStatus): boolean {
  return status === "CUTTING_IN_PROGRESS";
}

/** Statuses that ever reach the sewing floor. Everything else is invisible to sewing. */
export const SEWING_VISIBLE_STATUSES: readonly OrderStatus[] = ["VERIFIED", "SEWING_IN_PROGRESS"];

/** The Sewing Queue proper: verified batches waiting for assembly. */
export const SEWING_QUEUE_STATUS = "VERIFIED" as const satisfies OrderStatus;
