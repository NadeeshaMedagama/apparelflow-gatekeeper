import "server-only";
import { ORDER_STATUSES, type OrderStatus } from "@/domain/order-status";
import { calculateExpectedQuantity } from "@/domain/production";
import { isOrderEditable } from "@/domain/state-machine";
import type { CreateCuttingOrderInput, UpdateCuttingOrderInput } from "@/domain/validation";
import type { CuttingOrderDetailDTO, CuttingOrderSummaryDTO, StatusCounts } from "@/lib/dto";
import { assertPermission, type AuthUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/http/errors";
import { parseResourceId } from "@/server/http/request";
import {
  componentOrder,
  decimalToNumber,
  orderDetailInclude,
  orderSummaryInclude,
  toOrderDetailDTO,
  toOrderSummaryDTO,
} from "@/server/mappers";
import { applyTransition, assertTransition, inTransaction, lockOrder, type Tx } from "./shared";

const ORDER_NOT_FOUND = "Cutting order not found.";

function formatYards(value: number): string {
  return value.toFixed(2);
}

async function loadOrderDetail(tx: Tx, orderId: string): Promise<CuttingOrderDetailDTO> {
  const order = await tx.cuttingOrder.findUnique({ where: { id: orderId }, include: orderDetailInclude });
  if (!order) throw new NotFoundError(ORDER_NOT_FOUND);
  return toOrderDetailDTO(order);
}

export async function listCuttingOrders(
  actor: AuthUser,
  filter: { status?: OrderStatus } = {},
): Promise<CuttingOrderSummaryDTO[]> {
  assertPermission(actor, "order:read");
  const orders = await getPrisma().cuttingOrder.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    include: orderSummaryInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return orders.map(toOrderSummaryDTO);
}

export async function getOrderStatusCounts(actor: AuthUser): Promise<StatusCounts> {
  assertPermission(actor, "order:read");
  const groups = await getPrisma().cuttingOrder.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as StatusCounts;
  for (const group of groups) counts[group.status] = group._count._all;
  return counts;
}

export async function getCuttingOrder(actor: AuthUser, orderId: string): Promise<CuttingOrderDetailDTO> {
  assertPermission(actor, "order:read");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);
  const order = await getPrisma().cuttingOrder.findUnique({ where: { id }, include: orderDetailInclude });
  if (!order) throw new NotFoundError(ORDER_NOT_FOUND);
  return toOrderDetailDTO(order);
}

/**
 * Issues a fresh count sheet (one row per recipe component, with the
 * multiplier-derived expected quantity) and moves the batch to the QC station.
 */
async function submitInTransaction(tx: Tx, orderId: string, actor: AuthUser): Promise<void> {
  await lockOrder(tx, orderId, ORDER_NOT_FOUND);
  const order = await tx.cuttingOrder.findUnique({
    where: { id: orderId },
    include: { recipe: { include: { components: { orderBy: componentOrder } } } },
  });
  if (!order) throw new NotFoundError(ORDER_NOT_FOUND);
  assertTransition(order, "SUBMIT_FOR_VERIFICATION");

  if (order.recipe.components.length === 0) {
    throw new BusinessRuleError("EMPTY_RECIPE", `Recipe ${order.recipe.recipeCode} has no components to verify.`);
  }

  // Previous-round counts are already frozen in the rejection log snapshot.
  await tx.verificationItem.deleteMany({ where: { orderId } });
  await tx.verificationItem.createMany({
    data: order.recipe.components.map((component) => ({
      orderId,
      componentId: component.id,
      expectedQty: calculateExpectedQuantity(order.targetQty, component.piecesPerGarment),
    })),
  });

  const nextRound = order.verificationRound + 1;
  await applyTransition(tx, order, "SUBMIT_FOR_VERIFICATION", actor, {
    data: { verificationRound: { increment: 1 }, submittedAt: new Date() },
    note: nextRound === 1 ? "Bundles submitted to the QC station" : `Re-cut batch resubmitted for QC round ${nextRound}`,
  });
}

export async function createCuttingOrder(actor: AuthUser, input: CreateCuttingOrderInput): Promise<CuttingOrderDetailDTO> {
  assertPermission(actor, "order:create");

  const recipe = await getPrisma().recipe.findUnique({ where: { id: input.recipeId }, select: { id: true } });
  if (!recipe) {
    throw new BusinessRuleError("UNKNOWN_RECIPE", "The selected recipe does not exist.", {
      fieldErrors: { recipeId: ["Select a valid recipe"] },
    });
  }

  return inTransaction(async (tx) => {
    const order = await tx.cuttingOrder.create({
      data: {
        recipeId: input.recipeId,
        targetQty: input.targetQty,
        fabricRollId: input.fabricRollId,
        actualFabricYds: formatYards(input.actualFabricYds),
        createdById: actor.id,
      },
      select: { id: true },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: "CUTTING_IN_PROGRESS",
        actorId: actor.id,
        note: "Cutting order created",
      },
    });
    if (input.submitForVerification) {
      await submitInTransaction(tx, order.id, actor);
    }
    return loadOrderDetail(tx, order.id);
  });
}

export async function updateCuttingOrder(
  actor: AuthUser,
  orderId: string,
  input: UpdateCuttingOrderInput,
): Promise<CuttingOrderDetailDTO> {
  assertPermission(actor, "order:update");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);

  return inTransaction(async (tx) => {
    await lockOrder(tx, id, ORDER_NOT_FOUND);
    const order = await tx.cuttingOrder.findUniqueOrThrow({ where: { id } });
    if (!isOrderEditable(order.status)) {
      throw new ConflictError(
        "ORDER_LOCKED",
        `Order ${order.orderNo} is ${order.status}. Quantities and fabric can only be edited while cutting is in progress.`,
        { orderNo: order.orderNo, currentStatus: order.status },
      );
    }

    const changes: string[] = [];
    if (input.targetQty !== undefined && input.targetQty !== order.targetQty) {
      changes.push(`target ${order.targetQty} → ${input.targetQty} garments`);
    }
    if (input.fabricRollId !== undefined && input.fabricRollId !== order.fabricRollId) {
      changes.push(`fabric roll ${order.fabricRollId} → ${input.fabricRollId}`);
    }
    const currentYards = decimalToNumber(order.actualFabricYds);
    if (input.actualFabricYds !== undefined && input.actualFabricYds !== currentYards) {
      changes.push(`fabric used ${formatYards(currentYards)} → ${formatYards(input.actualFabricYds)} yds`);
    }

    if (changes.length > 0) {
      await tx.cuttingOrder.update({
        where: { id },
        data: {
          targetQty: input.targetQty,
          fabricRollId: input.fabricRollId,
          actualFabricYds: input.actualFabricYds === undefined ? undefined : formatYards(input.actualFabricYds),
        },
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: order.status,
          actorId: actor.id,
          note: `Order details updated: ${changes.join("; ")}`,
        },
      });
    }
    return loadOrderDetail(tx, id);
  });
}

export async function submitForVerification(actor: AuthUser, orderId: string): Promise<CuttingOrderDetailDTO> {
  assertPermission(actor, "order:submit");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);
  return inTransaction(async (tx) => {
    await submitInTransaction(tx, id, actor);
    return loadOrderDetail(tx, id);
  });
}

export async function startRecut(actor: AuthUser, orderId: string): Promise<CuttingOrderDetailDTO> {
  assertPermission(actor, "order:recut");
  const id = parseResourceId(orderId, ORDER_NOT_FOUND);
  return inTransaction(async (tx) => {
    await lockOrder(tx, id, ORDER_NOT_FOUND);
    const order = await tx.cuttingOrder.findUniqueOrThrow({ where: { id } });
    await applyTransition(tx, order, "START_RECUT", actor, {
      note: "Re-cut started after QC rejection",
    });
    return loadOrderDetail(tx, id);
  });
}
