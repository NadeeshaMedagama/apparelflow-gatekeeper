import "server-only";
import { evaluateVerificationGate, summarizeGateFailure, type GateEvaluation } from "@/domain/gate";
import type { RejectionCategory } from "@/domain/order-status";
import { calculateExpectedQuantity } from "@/domain/production";
import { classifyComponentCount } from "@/domain/traffic-light";
import type { ApproveBatchInput, RejectBatchInput, SaveCountsInput } from "@/domain/validation";
import type {
  CuttingOrderSummaryDTO,
  DecisionHistoryEntryDTO,
  PendingVerificationDTO,
  VerificationLogDTO,
  VerificationSheetDTO,
} from "@/lib/dto";
import { assertPermission, type AuthUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/http/errors";
import { parseResourceId } from "@/server/http/request";
import {
  componentOrder,
  decimalToNumber,
  orderSummaryInclude,
  projectWastage,
  toOrderSummaryDTO,
  toRecipeDTO,
  toRecipeRefDTO,
  toUserSummaryDTO,
  toVerificationItemDTO,
  toVerificationLogDTO,
  userSummarySelect,
  verificationItemInclude,
  verificationLogInclude,
} from "@/server/mappers";
import { applyTransition, inTransaction, lockOrder, type Tx } from "./shared";

const ORDER_NOT_FOUND = "Cutting order not found.";

const qcOrderInclude = {
  ...orderSummaryInclude,
  recipe: { include: { components: { orderBy: componentOrder } } },
  verificationItems: { include: verificationItemInclude, orderBy: { component: { sortOrder: "asc" } } },
  verificationLogs: { include: verificationLogInclude, orderBy: { round: "desc" } },
} as const;

type QcOrder = NonNullable<Awaited<ReturnType<typeof findQcOrder>>>;

function findQcOrder(tx: Tx, orderId: string) {
  return tx.cuttingOrder.findUnique({ where: { id: orderId }, include: qcOrderInclude });
}

/** Loads an order under a row lock for a QC action. */
async function loadLockedQcOrder(tx: Tx, orderId: string): Promise<QcOrder> {
  await lockOrder(tx, orderId, ORDER_NOT_FOUND);
  const order = await findQcOrder(tx, orderId);
  if (!order) throw new NotFoundError(ORDER_NOT_FOUND);
  return order;
}

/**
 * Evaluates the hard-stop gate. Requirements come from the RECIPE (target ×
 * pieces per garment), not from the stored count sheet, so a tampered
 * expected quantity cannot lower the bar.
 */
function evaluateGate(order: QcOrder): GateEvaluation {
  const requirements = order.recipe.components.map((component) => ({
    componentId: component.id,
    componentName: component.componentName,
    expectedQty: calculateExpectedQuantity(order.targetQty, component.piecesPerGarment),
  }));
  const counts = order.verificationItems.map((item) => ({
    componentId: item.componentId,
    expectedQty: item.expectedQty,
    actualQty: item.actualQty,
  }));
  return evaluateVerificationGate(requirements, counts);
}

/** Immutable per-component snapshot written alongside each decision. */
function snapshotLogItems(order: QcOrder) {
  const itemsByComponent = new Map(order.verificationItems.map((item) => [item.componentId, item]));
  return order.recipe.components.map((component) => {
    const expectedQty = calculateExpectedQuantity(order.targetQty, component.piecesPerGarment);
    const actualQty = itemsByComponent.get(component.id)?.actualQty ?? null;
    return {
      componentId: component.id,
      componentName: component.componentName,
      piecesPerGarment: component.piecesPerGarment,
      expectedQty,
      actualQty,
      variance: actualQty === null ? null : actualQty - expectedQty,
      status: actualQty === null ? null : classifyComponentCount(expectedQty, actualQty),
    };
  });
}

function toSheetDTO(order: QcOrder): VerificationSheetDTO {
  return {
    order: toOrderSummaryDTO(order),
    recipe: toRecipeDTO(order.recipe),
    items: order.verificationItems.map(toVerificationItemDTO),
    gate: evaluateGate(order),
    wastage: projectWastage(order),
    logs: order.verificationLogs.map(toVerificationLogDTO),
  };
}

export interface DecisionResultDTO {
  order: CuttingOrderSummaryDTO;
  log: VerificationLogDTO;
}

/* ------------------------------------------------------------------------ */
/* Queries                                                                   */
/* ------------------------------------------------------------------------ */

export async function listPendingVerifications(actor: AuthUser): Promise<PendingVerificationDTO[]> {
  assertPermission(actor, "verification:read");
  const orders = await getPrisma().cuttingOrder.findMany({
    where: { status: "PENDING_VERIFICATION" },
    include: { ...orderSummaryInclude, verificationItems: { select: { actualQty: true } } },
    orderBy: [{ submittedAt: "asc" }, { orderNo: "asc" }],
  });
  return orders.map((order) => ({
    ...toOrderSummaryDTO(order),
    componentCount: order.verificationItems.length,
    countedCount: order.verificationItems.filter((item) => item.actualQty !== null).length,
  }));
}

/** The verifier terminal payload. Orders that never reached QC are not visible to verifiers. */
export async function getVerificationSheet(actor: AuthUser, orderId: string): Promise<VerificationSheetDTO> {
  assertPermission(actor, "verification:read");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);
  const order = await findQcOrder(getPrisma(), id);
  if (!order || order.verificationRound === 0) throw new NotFoundError(ORDER_NOT_FOUND);
  return toSheetDTO(order);
}

export async function listDecisionHistory(actor: AuthUser, options: { limit?: number } = {}): Promise<DecisionHistoryEntryDTO[]> {
  assertPermission(actor, "verification:read");
  const logs = await getPrisma().verificationLog.findMany({
    orderBy: { timestamp: "desc" },
    take: Math.min(Math.max(options.limit ?? 100, 1), 200),
    include: {
      verifier: { select: userSummarySelect },
      order: { select: { id: true, orderNo: true, targetQty: true, recipe: true } },
    },
  });
  return logs.map((log) => {
    const wastagePct = decimalToNumber(log.wastagePct);
    return {
      id: log.id,
      decision: log.decision,
      round: log.round,
      rejectionCategory: log.rejectionCategory,
      note: log.decision === "REJECTED" ? log.rejectionNote : log.approvalNote,
      wastagePct,
      exceedsWastageCap: wastagePct > decimalToNumber(log.wastageCap),
      timestamp: log.timestamp.toISOString(),
      verifier: toUserSummaryDTO(log.verifier),
      order: {
        id: log.order.id,
        orderNo: log.order.orderNo,
        targetQty: log.order.targetQty,
        recipe: toRecipeRefDTO(log.order.recipe),
      },
    };
  });
}

export async function getVerificationStats(actor: AuthUser) {
  assertPermission(actor, "verification:read");
  const prisma = getPrisma();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pending, approved24h, rejected24h, myDecisions] = await Promise.all([
    prisma.cuttingOrder.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.verificationLog.count({ where: { decision: "APPROVED", timestamp: { gte: since } } }),
    prisma.verificationLog.count({ where: { decision: "REJECTED", timestamp: { gte: since } } }),
    prisma.verificationLog.count({ where: { verifierId: actor.id } }),
  ]);
  return { pending, approved24h, rejected24h, myDecisions };
}

/* ------------------------------------------------------------------------ */
/* Commands                                                                  */
/* ------------------------------------------------------------------------ */

/** Records physical counts. Status is always derived here — never accepted from the client. */
export async function saveComponentCounts(
  actor: AuthUser,
  orderId: string,
  input: SaveCountsInput,
): Promise<VerificationSheetDTO> {
  assertPermission(actor, "verification:count");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);

  return inTransaction(async (tx) => {
    const order = await loadLockedQcOrder(tx, id);
    if (order.status !== "PENDING_VERIFICATION") {
      throw new ConflictError(
        "INVALID_STATE_TRANSITION",
        `Order ${order.orderNo} is ${order.status}. Counts can only be recorded while the batch is PENDING_VERIFICATION.`,
        { orderNo: order.orderNo, currentStatus: order.status, requiredStatus: "PENDING_VERIFICATION" },
      );
    }

    const itemsByComponent = new Map(order.verificationItems.map((item) => [item.componentId, item]));
    const unknown = input.items.filter((entry) => !itemsByComponent.has(entry.componentId));
    if (unknown.length > 0) {
      throw new BusinessRuleError("UNKNOWN_COMPONENT", "One or more components are not on this batch's count sheet.", {
        componentIds: unknown.map((entry) => entry.componentId),
      });
    }

    const countedAt = new Date();
    for (const entry of input.items) {
      const item = itemsByComponent.get(entry.componentId)!;
      await tx.verificationItem.update({
        where: { id: item.id },
        data: {
          actualQty: entry.actualQty,
          status: classifyComponentCount(item.expectedQty, entry.actualQty),
          countedById: actor.id,
          countedAt,
        },
      });
    }

    const refreshed = await findQcOrder(tx, id);
    if (!refreshed) throw new NotFoundError(ORDER_NOT_FOUND);
    return toSheetDTO(refreshed);
  });
}

/**
 * GATEKEEPER HARD STOP — the only way a batch becomes VERIFIED.
 *
 *  1. caller must hold `verification:decide` (403 otherwise)
 *  2. order row is locked; it must be PENDING_VERIFICATION (409 otherwise)
 *  3. every recipe component must be present, counted and not short (422 otherwise)
 *  4. wastage is computed server-side; the audit log (verifier from the
 *     session, DB timestamp, per-component snapshot) and the status change
 *     commit atomically — or not at all.
 */
export async function approveBatch(actor: AuthUser, orderId: string, input: ApproveBatchInput): Promise<DecisionResultDTO> {
  assertPermission(actor, "verification:decide");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);

  return inTransaction(async (tx) => {
    const order = await loadLockedQcOrder(tx, id);
    if (order.status !== "PENDING_VERIFICATION") {
      throw new ConflictError(
        "INVALID_STATE_TRANSITION",
        `Order ${order.orderNo} is ${order.status}. Only PENDING_VERIFICATION batches can be approved.`,
        { orderNo: order.orderNo, currentStatus: order.status, requiredStatus: "PENDING_VERIFICATION" },
      );
    }

    const gate = evaluateGate(order);
    if (!gate.passed) {
      throw new BusinessRuleError("VERIFICATION_GATE_BLOCKED", summarizeGateFailure(gate), {
        orderNo: order.orderNo,
        totals: gate.totals,
        violations: gate.violations,
      });
    }

    const wastage = projectWastage(order);
    const log = await tx.verificationLog.create({
      data: {
        orderId: order.id,
        verifierId: actor.id,
        decision: "APPROVED",
        round: order.verificationRound,
        approvalNote: input.note ? input.note : null,
        wastagePct: wastage.wastagePct.toFixed(2),
        wastageCap: wastage.wastageCap.toFixed(2),
        expectedFabricYds: wastage.expectedFabricYds.toFixed(3),
        actualFabricYds: wastage.actualFabricYds.toFixed(2),
        targetQty: order.targetQty,
        items: { create: snapshotLogItems(order) },
      },
      include: verificationLogInclude,
    });

    await applyTransition(tx, order, "APPROVE", actor, {
      data: { verifiedAt: log.timestamp },
      note: input.note ? `Approved: ${input.note}` : "All components verified — released to the Sewing Queue",
    });

    const updated = await tx.cuttingOrder.findUniqueOrThrow({ where: { id }, include: orderSummaryInclude });
    return { order: toOrderSummaryDTO(updated), log: toVerificationLogDTO(log) };
  });
}

/** Rejects a batch back to the Cutting Supervisor. A reason note is mandatory. */
export async function rejectBatch(actor: AuthUser, orderId: string, input: RejectBatchInput): Promise<DecisionResultDTO> {
  assertPermission(actor, "verification:decide");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);

  return inTransaction(async (tx) => {
    const order = await loadLockedQcOrder(tx, id);
    if (order.status !== "PENDING_VERIFICATION") {
      throw new ConflictError(
        "INVALID_STATE_TRANSITION",
        `Order ${order.orderNo} is ${order.status}. Only PENDING_VERIFICATION batches can be rejected.`,
        { orderNo: order.orderNo, currentStatus: order.status, requiredStatus: "PENDING_VERIFICATION" },
      );
    }

    const gate = evaluateGate(order);
    const category: RejectionCategory = input.category ?? (gate.totals.red > 0 ? "COMPONENT_SHORTAGE" : "OTHER");
    const wastage = projectWastage(order);

    const log = await tx.verificationLog.create({
      data: {
        orderId: order.id,
        verifierId: actor.id,
        decision: "REJECTED",
        round: order.verificationRound,
        rejectionCategory: category,
        rejectionNote: input.reason,
        wastagePct: wastage.wastagePct.toFixed(2),
        wastageCap: wastage.wastageCap.toFixed(2),
        expectedFabricYds: wastage.expectedFabricYds.toFixed(3),
        actualFabricYds: wastage.actualFabricYds.toFixed(2),
        targetQty: order.targetQty,
        items: { create: snapshotLogItems(order) },
      },
      include: verificationLogInclude,
    });

    await applyTransition(tx, order, "REJECT", actor, { note: input.reason });

    const updated = await tx.cuttingOrder.findUniqueOrThrow({ where: { id }, include: orderSummaryInclude });
    return { order: toOrderSummaryDTO(updated), log: toVerificationLogDTO(log) };
  });
}
