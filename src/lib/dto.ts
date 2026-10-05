/**
 * Data transfer objects returned by the API and passed from Server Components
 * to Client Components. Plain JSON only: decimals are numbers, dates are ISO
 * strings — no ORM objects ever cross the network boundary.
 */
import type { GateEvaluation } from "@/domain/gate";
import type {
  OrderStatus,
  RejectionCategory,
  VerificationDecision,
} from "@/domain/order-status";
import type { Role } from "@/domain/roles";
import type { ComponentStatus } from "@/domain/traffic-light";
import type { WastageResult } from "@/domain/wastage";

export interface UserSummaryDTO {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface RecipeComponentDTO {
  id: string;
  componentName: string;
  piecesPerGarment: number;
  imageUrl: string | null;
  sortOrder: number;
}

export interface RecipeDTO {
  id: string;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: RecipeComponentDTO[];
}

export interface RecipeRefDTO {
  id: string;
  recipeCode: string;
  name: string;
  category: string;
}

export interface ExpectedComponentDTO extends RecipeComponentDTO {
  expectedQty: number;
}

export interface CuttingOrderSummaryDTO {
  id: string;
  orderNo: string;
  status: OrderStatus;
  recipe: RecipeRefDTO;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  expectedFabricYds: number;
  verificationRound: number;
  createdBy: UserSummaryDTO;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  sewingStartedAt: string | null;
}

export interface VerificationItemDTO {
  id: string;
  componentId: string;
  componentName: string;
  piecesPerGarment: number;
  imageUrl: string | null;
  expectedQty: number;
  actualQty: number | null;
  status: ComponentStatus | null;
  variance: number | null;
  countedAt: string | null;
  countedBy: UserSummaryDTO | null;
}

export interface VerificationLogItemDTO {
  componentId: string;
  componentName: string;
  piecesPerGarment: number;
  expectedQty: number;
  actualQty: number | null;
  variance: number | null;
  status: ComponentStatus | null;
}

export interface VerificationLogDTO {
  id: string;
  orderId: string;
  decision: VerificationDecision;
  round: number;
  rejectionCategory: RejectionCategory | null;
  rejectionNote: string | null;
  approvalNote: string | null;
  wastagePct: number;
  wastageCap: number;
  exceedsWastageCap: boolean;
  expectedFabricYds: number;
  actualFabricYds: number;
  targetQty: number;
  timestamp: string;
  verifier: UserSummaryDTO;
  items: VerificationLogItemDTO[];
}

export interface StatusEventDTO {
  id: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
  actor: UserSummaryDTO;
}

export interface CuttingOrderDetailDTO extends CuttingOrderSummaryDTO {
  recipeDetail: RecipeDTO;
  expectedComponents: ExpectedComponentDTO[];
  projectedWastage: WastageResult;
  verificationItems: VerificationItemDTO[];
  verificationLogs: VerificationLogDTO[];
  events: StatusEventDTO[];
}

/** Verifier terminal payload: the order, its live count sheet and the gate verdict. */
export interface VerificationSheetDTO {
  order: CuttingOrderSummaryDTO;
  recipe: RecipeDTO;
  items: VerificationItemDTO[];
  gate: GateEvaluation;
  wastage: WastageResult;
  logs: VerificationLogDTO[];
}

export interface PendingVerificationDTO extends CuttingOrderSummaryDTO {
  componentCount: number;
  countedCount: number;
}

export interface DecisionHistoryEntryDTO {
  id: string;
  decision: VerificationDecision;
  round: number;
  rejectionCategory: RejectionCategory | null;
  note: string | null;
  wastagePct: number;
  exceedsWastageCap: boolean;
  timestamp: string;
  verifier: UserSummaryDTO;
  order: { id: string; orderNo: string; targetQty: number; recipe: RecipeRefDTO };
}

/** What the sewing floor is allowed to see: verified lineage only, never rejection history. */
export interface SewingBatchDTO {
  id: string;
  orderNo: string;
  status: Extract<OrderStatus, "VERIFIED" | "SEWING_IN_PROGRESS">;
  recipe: RecipeRefDTO;
  targetQty: number;
  fabricRollId: string;
  verifiedAt: string;
  sewingStartedAt: string | null;
  sewingStartedBy: UserSummaryDTO | null;
  approval: VerificationLogDTO;
}

export type StatusCounts = Record<OrderStatus, number>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
