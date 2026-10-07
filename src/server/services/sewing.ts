import "server-only";
import { SEWING_QUEUE_STATUS, SEWING_VISIBLE_STATUSES } from "@/domain/state-machine";
import type { SewingBatchDTO } from "@/lib/dto";
import { assertPermission, type AuthUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/http/errors";
import { parseResourceId } from "@/server/http/request";
import {
  toRecipeRefDTO,
  toUserSummaryDTO,
  toVerificationLogDTO,
  userSummarySelect,
  verificationLogInclude,
} from "@/server/mappers";
import { applyTransition, inTransaction, lockOrder } from "./shared";

const NOT_IN_QUEUE = "Batch not found in the sewing queue.";

/**
 * The sewing floor's view of an order. Only the APPROVED verification record
 * is loaded — rejection history and live count sheets never reach this role.
 */
const sewingInclude = {
  recipe: { select: { id: true, recipeCode: true, name: true, category: true, stdFabricYards: true, wastageCap: true } },
  sewingStartedBy: { select: userSummarySelect },
  verificationLogs: { where: { decision: "APPROVED" }, include: verificationLogInclude, take: 1 },
} as const;

type SewingRecord = {
  id: string;
  orderNo: string;
  status: string;
  targetQty: number;
  fabricRollId: string;
  verifiedAt: Date | null;
  sewingStartedAt: Date | null;
  recipe: Parameters<typeof toRecipeRefDTO>[0];
  sewingStartedBy: Parameters<typeof toUserSummaryDTO>[0] | null;
  verificationLogs: Array<Parameters<typeof toVerificationLogDTO>[0]>;
};

function toSewingBatchDTO(order: SewingRecord): SewingBatchDTO {
  const approval = order.verificationLogs[0];
  if ((order.status !== "VERIFIED" && order.status !== "SEWING_IN_PROGRESS") || !approval || !order.verifiedAt) {
    // Unreachable while the database guards hold; fail closed rather than leak.
    throw new Error(`Integrity violation: ${order.orderNo} is visible to sewing without an approval record.`);
  }
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    recipe: toRecipeRefDTO(order.recipe),
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId,
    verifiedAt: order.verifiedAt.toISOString(),
    sewingStartedAt: order.sewingStartedAt?.toISOString() ?? null,
    sewingStartedBy: order.sewingStartedBy ? toUserSummaryDTO(order.sewingStartedBy) : null,
    approval: toVerificationLogDTO(approval),
  };
}

/**
 * GET /api/sewing/queue — query isolation is enforced in the database query
 * itself (WHERE status = 'VERIFIED'). No caller-supplied value can widen it.
 */
export async function getSewingQueue(actor: AuthUser): Promise<SewingBatchDTO[]> {
  assertPermission(actor, "sewing:read");
  const orders = await getPrisma().cuttingOrder.findMany({
    where: { status: SEWING_QUEUE_STATUS },
    include: sewingInclude,
    orderBy: [{ verifiedAt: "asc" }, { orderNo: "asc" }],
  });
  return orders.map(toSewingBatchDTO);
}

/** Batches already on the assembly line (also verified lineage only). */
export async function getAssemblyInProgress(actor: AuthUser): Promise<SewingBatchDTO[]> {
  assertPermission(actor, "sewing:read");
  const orders = await getPrisma().cuttingOrder.findMany({
    where: { status: "SEWING_IN_PROGRESS" },
    include: sewingInclude,
    orderBy: [{ sewingStartedAt: "desc" }, { orderNo: "asc" }],
    take: 100,
  });
  return orders.map(toSewingBatchDTO);
}

/** Unverified orders are reported as 404 — their existence is not disclosed to sewing. */
export async function getSewingBatch(actor: AuthUser, orderId: string): Promise<SewingBatchDTO> {
  assertPermission(actor, "sewing:read");
  const id = parseResourceId(orderId, NOT_IN_QUEUE);
  const order = await getPrisma().cuttingOrder.findFirst({
    where: { id, status: { in: [...SEWING_VISIBLE_STATUSES] } },
    include: sewingInclude,
  });
  if (!order) throw new NotFoundError(NOT_IN_QUEUE);
  return toSewingBatchDTO(order);
}

export async function startSewingAssembly(actor: AuthUser, orderId: string): Promise<SewingBatchDTO> {
  assertPermission(actor, "sewing:start");
  const id = parseResourceId(orderId, NOT_IN_QUEUE);

  return inTransaction(async (tx) => {
    await lockOrder(tx, id, NOT_IN_QUEUE);
    const order = await tx.cuttingOrder.findUniqueOrThrow({ where: { id } });
    if (!SEWING_VISIBLE_STATUSES.includes(order.status)) {
      throw new NotFoundError(NOT_IN_QUEUE);
    }
    if (order.status === "SEWING_IN_PROGRESS") {
      throw new ConflictError("SEWING_ALREADY_STARTED", `Sewing assembly for ${order.orderNo} has already started.`, {
        orderNo: order.orderNo,
      });
    }
    await applyTransition(tx, order, "START_SEWING", actor, {
      data: { sewingStartedAt: new Date(), sewingStartedById: actor.id },
      note: "Released to the assembly line",
    });
    const updated = await tx.cuttingOrder.findUniqueOrThrow({ where: { id }, include: sewingInclude });
    return toSewingBatchDTO(updated);
  });
}

export async function getSewingStats(actor: AuthUser) {
  assertPermission(actor, "sewing:read");
  const prisma = getPrisma();
  const [ready, inAssembly, garments] = await Promise.all([
    prisma.cuttingOrder.count({ where: { status: SEWING_QUEUE_STATUS } }),
    prisma.cuttingOrder.count({ where: { status: "SEWING_IN_PROGRESS" } }),
    prisma.cuttingOrder.aggregate({ where: { status: SEWING_QUEUE_STATUS }, _sum: { targetQty: true } }),
  ]);
  return { ready, inAssembly, garmentsReady: garments._sum.targetQty ?? 0 };
}
