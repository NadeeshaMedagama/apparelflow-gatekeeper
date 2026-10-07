/**
 * Traffic-light status matrix for physical component counts.
 *
 *   GREEN  (match)    actual == expected → satisfies verification
 *   YELLOW (excess)   actual >  expected → surplus recorded, batch may proceed
 *   RED    (shortage) actual <  expected → assembly incomplete, approval blocked
 */

export const COMPONENT_STATUSES = ["GREEN", "YELLOW", "RED"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

export function classifyComponentCount(expectedQty: number, actualQty: number): ComponentStatus {
  if (!Number.isSafeInteger(expectedQty) || expectedQty <= 0) {
    throw new RangeError(`Expected quantity must be a positive whole number, received ${expectedQty}`);
  }
  if (!Number.isSafeInteger(actualQty) || actualQty < 0) {
    throw new RangeError(`Actual count must be a non-negative whole number, received ${actualQty}`);
  }
  if (actualQty === expectedQty) return "GREEN";
  return actualQty > expectedQty ? "YELLOW" : "RED";
}

/** Signed variance: positive = surplus, negative = shortage. */
export function countVariance(expectedQty: number, actualQty: number): number {
  return actualQty - expectedQty;
}

export const COMPONENT_STATUS_META: Record<
  ComponentStatus,
  { label: string; meaning: string; blocksApproval: boolean }
> = {
  GREEN: { label: "Match", meaning: "Exact component match", blocksApproval: false },
  YELLOW: { label: "Excess", meaning: "Surplus pieces — flag for return or safety margin", blocksApproval: false },
  RED: { label: "Shortage", meaning: "Defect shortage — garment assembly incomplete", blocksApproval: true },
};
