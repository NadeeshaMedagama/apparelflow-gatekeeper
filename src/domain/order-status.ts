export const ORDER_STATUSES = [
  "CUTTING_IN_PROGRESS",
  "PENDING_VERIFICATION",
  "REJECTED",
  "VERIFIED",
  "SEWING_IN_PROGRESS",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CUTTING_IN_PROGRESS: "Cutting in progress",
  PENDING_VERIFICATION: "Pending verification",
  REJECTED: "Rejected — re-cut required",
  VERIFIED: "Verified",
  SEWING_IN_PROGRESS: "Sewing in progress",
};

export const ORDER_STATUS_SHORT_LABELS: Record<OrderStatus, string> = {
  CUTTING_IN_PROGRESS: "In cutting",
  PENDING_VERIFICATION: "Pending QC",
  REJECTED: "Rejected",
  VERIFIED: "Verified",
  SEWING_IN_PROGRESS: "In sewing",
};

export const REJECTION_CATEGORIES = [
  "COMPONENT_SHORTAGE",
  "FABRIC_DEFECT",
  "CUTTING_DEFECT",
  "COUNT_MISMATCH",
  "OTHER",
] as const;
export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export const REJECTION_CATEGORY_LABELS: Record<RejectionCategory, string> = {
  COMPONENT_SHORTAGE: "Component shortage",
  FABRIC_DEFECT: "Fabric defect",
  CUTTING_DEFECT: "Cutting defect / mis-cut",
  COUNT_MISMATCH: "Bundle count mismatch",
  OTHER: "Other",
};

export const VERIFICATION_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];
