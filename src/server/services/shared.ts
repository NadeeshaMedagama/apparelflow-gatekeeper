import "server-only";
import type { Prisma } from "@prisma/client";
import type { OrderStatus } from "@/domain/order-status";
import { resolveTransition, TRANSITIONS, type OrderAction } from "@/domain/state-machine";
import type { AuthUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/http/errors";

export type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** Runs `work` in a single database transaction (all-or-nothing). */
export function inTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(work, TRANSACTION_OPTIONS);
}

/**
 * Takes a row lock on the order for the rest of the transaction, serialising
 * concurrent approve / reject / count / submit requests for the same batch.
 */
export async function lockOrder(tx: Tx, orderId: string, notFoundMessage = "Cutting order not found."): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM cutting_orders WHERE id = ${orderId}::uuid FOR UPDATE
  `;
  if (rows.length !== 1) throw new NotFoundError(notFoundMessage);
}

/** 409 when the action is not legal from the order's current status. */
export function assertTransition(order: { orderNo: string; status: OrderStatus }, action: OrderAction): void {
  const result = resolveTransition(order.status, action);
  if (!result.allowed) {
    throw new ConflictError(
      "INVALID_STATE_TRANSITION",
      `Order ${order.orderNo} is ${order.status}. "${TRANSITIONS[action].label}" requires ${result.requiredFrom}.`,
      { orderNo: order.orderNo, currentStatus: order.status, requiredStatus: result.requiredFrom, action },
    );
  }
}

/**
 * The only code path that changes an order's status. The UPDATE is guarded by
 * the expected `from` status (compare-and-set), and every transition appends
 * an immutable status event attributed to the authenticated actor.
 */
export async function applyTransition(
  tx: Tx,
  order: { id: string; orderNo: string; status: OrderStatus },
  action: OrderAction,
  actor: AuthUser,
  options: { data?: Omit<Prisma.CuttingOrderUncheckedUpdateManyInput, "status">; note?: string | null } = {},
): Promise<void> {
  assertTransition(order, action);
  const rule = TRANSITIONS[action];
  const result = await tx.cuttingOrder.updateMany({
    where: { id: order.id, status: rule.from },
    data: { ...options.data, status: rule.to },
  });
  if (result.count !== 1) {
    throw new ConflictError(
      "CONCURRENT_MODIFICATION",
      `Order ${order.orderNo} changed while this request was being processed. Reload and try again.`,
    );
  }
  await tx.orderStatusEvent.create({
    data: {
      orderId: order.id,
      fromStatus: rule.from,
      toStatus: rule.to,
      actorId: actor.id,
      note: options.note ?? null,
    },
  });
}
