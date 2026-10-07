import "server-only";
import type { Prisma } from "@prisma/client";
import { calculateExpectedComponents } from "@/domain/production";
import type { OrderStatus, RejectionCategory, VerificationDecision } from "@/domain/order-status";
import type { Role } from "@/domain/roles";
import type { ComponentStatus } from "@/domain/traffic-light";
import { calculateExpectedFabricYards, evaluateWastage } from "@/domain/wastage";
import type {
  CuttingOrderDetailDTO,
  CuttingOrderSummaryDTO,
  RecipeComponentDTO,
  RecipeDTO,
  RecipeRefDTO,
  StatusEventDTO,
  UserSummaryDTO,
  VerificationItemDTO,
  VerificationLogDTO,
  VerificationLogItemDTO,
} from "@/lib/dto";

/* ------------------------------------------------------------------------ */
/* Query shapes                                                              */
/* ------------------------------------------------------------------------ */

export const userSummarySelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

export const recipeRefSelect = {
  id: true,
  recipeCode: true,
  name: true,
  category: true,
  stdFabricYards: true,
  wastageCap: true,
} satisfies Prisma.RecipeSelect;

export const componentOrder = [{ sortOrder: "asc" }, { componentName: "asc" }] satisfies Prisma.RecipeComponentOrderByWithRelationInput[];

export const recipeWithComponentsInclude = {
  components: { orderBy: componentOrder },
} satisfies Prisma.RecipeInclude;

export const orderSummaryInclude = {
  recipe: { select: recipeRefSelect },
  createdBy: { select: userSummarySelect },
} satisfies Prisma.CuttingOrderInclude;

export const verificationItemInclude = {
  component: { select: { id: true, componentName: true, piecesPerGarment: true, imageUrl: true, sortOrder: true } },
  countedBy: { select: userSummarySelect },
} satisfies Prisma.VerificationItemInclude;

export const verificationLogInclude = {
  verifier: { select: userSummarySelect },
  items: { orderBy: { component: { sortOrder: "asc" } } },
} satisfies Prisma.VerificationLogInclude;

export const orderDetailInclude = {
  recipe: { include: recipeWithComponentsInclude },
  createdBy: { select: userSummarySelect },
  verificationItems: { include: verificationItemInclude, orderBy: { component: { sortOrder: "asc" } } },
  verificationLogs: { include: verificationLogInclude, orderBy: { round: "desc" } },
  statusEvents: { include: { actor: { select: userSummarySelect } }, orderBy: { id: "asc" } },
} satisfies Prisma.CuttingOrderInclude;

/* ------------------------------------------------------------------------ */
/* Structural record types (decoupled from specific query payloads)          */
/* ------------------------------------------------------------------------ */

interface Decimalish {
  toString(): string;
}

interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

interface RecipeRefRecord {
  id: string;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: Decimalish;
  wastageCap: Decimalish;
}

interface ComponentRecord {
  id: string;
  componentName: string;
  piecesPerGarment: number;
  imageUrl: string | null;
  sortOrder: number;
}

interface RecipeRecord extends RecipeRefRecord {
  components: ComponentRecord[];
}

interface OrderRecord {
  id: string;
  orderNo: string;
  status: OrderStatus;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: Decimalish;
  verificationRound: number;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  sewingStartedAt: Date | null;
  recipe: RecipeRefRecord;
  createdBy: UserRecord;
}

interface VerificationItemRecord {
  id: string;
  componentId: string;
  expectedQty: number;
  actualQty: number | null;
  status: ComponentStatus | null;
  countedAt: Date | null;
  component: ComponentRecord;
  countedBy: UserRecord | null;
}

interface VerificationLogItemRecord {
  componentId: string;
  componentName: string;
  piecesPerGarment: number;
  expectedQty: number;
  actualQty: number | null;
  variance: number | null;
  status: ComponentStatus | null;
}

interface VerificationLogRecord {
  id: string;
  orderId: string;
  decision: VerificationDecision;
  round: number;
  rejectionCategory: RejectionCategory | null;
  rejectionNote: string | null;
  approvalNote: string | null;
  wastagePct: Decimalish;
  wastageCap: Decimalish;
  expectedFabricYds: Decimalish;
  actualFabricYds: Decimalish;
  targetQty: number;
  timestamp: Date;
  verifier: UserRecord;
  items: VerificationLogItemRecord[];
}

interface StatusEventRecord {
  id: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: Date;
  actor: UserRecord;
}

/* ------------------------------------------------------------------------ */
/* Mappers                                                                   */
/* ------------------------------------------------------------------------ */

export function decimalToNumber(value: Decimalish): number {
  return Number(value.toString());
}

function iso(value: Date): string;
function iso(value: Date | null): string | null;
function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toUserSummaryDTO(user: UserRecord): UserSummaryDTO {
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
}

export function toRecipeRefDTO(recipe: RecipeRefRecord): RecipeRefDTO {
  return { id: recipe.id, recipeCode: recipe.recipeCode, name: recipe.name, category: recipe.category };
}

export function toRecipeComponentDTO(component: ComponentRecord): RecipeComponentDTO {
  return {
    id: component.id,
    componentName: component.componentName,
    piecesPerGarment: component.piecesPerGarment,
    imageUrl: component.imageUrl,
    sortOrder: component.sortOrder,
  };
}

export function toRecipeDTO(recipe: RecipeRecord): RecipeDTO {
  return {
    ...toRecipeRefDTO(recipe),
    stdFabricYards: decimalToNumber(recipe.stdFabricYards),
    wastageCap: decimalToNumber(recipe.wastageCap),
    components: recipe.components.map(toRecipeComponentDTO),
  };
}

export function toOrderSummaryDTO(order: OrderRecord): CuttingOrderSummaryDTO {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    recipe: toRecipeRefDTO(order.recipe),
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId,
    actualFabricYds: decimalToNumber(order.actualFabricYds),
    expectedFabricYds: calculateExpectedFabricYards(order.targetQty, order.recipe.stdFabricYards.toString()),
    verificationRound: order.verificationRound,
    createdBy: toUserSummaryDTO(order.createdBy),
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    submittedAt: iso(order.submittedAt),
    verifiedAt: iso(order.verifiedAt),
    sewingStartedAt: iso(order.sewingStartedAt),
  };
}

export function toVerificationItemDTO(item: VerificationItemRecord): VerificationItemDTO {
  return {
    id: item.id,
    componentId: item.componentId,
    componentName: item.component.componentName,
    piecesPerGarment: item.component.piecesPerGarment,
    imageUrl: item.component.imageUrl,
    expectedQty: item.expectedQty,
    actualQty: item.actualQty,
    status: item.status,
    variance: item.actualQty === null ? null : item.actualQty - item.expectedQty,
    countedAt: iso(item.countedAt),
    countedBy: item.countedBy ? toUserSummaryDTO(item.countedBy) : null,
  };
}

function toLogItemDTO(item: VerificationLogItemRecord): VerificationLogItemDTO {
  return {
    componentId: item.componentId,
    componentName: item.componentName,
    piecesPerGarment: item.piecesPerGarment,
    expectedQty: item.expectedQty,
    actualQty: item.actualQty,
    variance: item.variance,
    status: item.status,
  };
}

export function toVerificationLogDTO(log: VerificationLogRecord): VerificationLogDTO {
  const wastagePct = decimalToNumber(log.wastagePct);
  const wastageCap = decimalToNumber(log.wastageCap);
  return {
    id: log.id,
    orderId: log.orderId,
    decision: log.decision,
    round: log.round,
    rejectionCategory: log.rejectionCategory,
    rejectionNote: log.rejectionNote,
    approvalNote: log.approvalNote,
    wastagePct,
    wastageCap,
    exceedsWastageCap: wastagePct > wastageCap,
    expectedFabricYds: decimalToNumber(log.expectedFabricYds),
    actualFabricYds: decimalToNumber(log.actualFabricYds),
    targetQty: log.targetQty,
    timestamp: iso(log.timestamp),
    verifier: toUserSummaryDTO(log.verifier),
    items: log.items.map(toLogItemDTO),
  };
}

export function toStatusEventDTO(event: StatusEventRecord): StatusEventDTO {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note,
    createdAt: iso(event.createdAt),
    actor: toUserSummaryDTO(event.actor),
  };
}

export function projectWastage(order: { targetQty: number; actualFabricYds: Decimalish; recipe: RecipeRefRecord }) {
  return evaluateWastage({
    targetQty: order.targetQty,
    stdFabricYards: order.recipe.stdFabricYards.toString(),
    actualFabricYds: order.actualFabricYds.toString(),
    wastageCap: order.recipe.wastageCap.toString(),
  });
}

export function toOrderDetailDTO(
  order: OrderRecord & {
    recipe: RecipeRecord;
    verificationItems: VerificationItemRecord[];
    verificationLogs: VerificationLogRecord[];
    statusEvents: StatusEventRecord[];
  },
): CuttingOrderDetailDTO {
  const recipeDetail = toRecipeDTO(order.recipe);
  return {
    ...toOrderSummaryDTO(order),
    recipeDetail,
    expectedComponents: calculateExpectedComponents(order.targetQty, recipeDetail.components),
    projectedWastage: projectWastage(order),
    verificationItems: order.verificationItems.map(toVerificationItemDTO),
    verificationLogs: order.verificationLogs.map(toVerificationLogDTO),
    events: order.statusEvents.map(toStatusEventDTO),
  };
}
