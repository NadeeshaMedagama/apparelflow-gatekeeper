/**
 * Operational bounds for user-entered values. Shared by client forms, API
 * validation and database CHECK constraints so all three layers agree.
 */
export const LIMITS = {
  targetQty: { min: 1, max: 50_000 },
  componentCount: { min: 0, max: 10_000_000 },
  fabricYards: { min: 0.01, max: 1_000_000, decimals: 2 },
  fabricRollId: { min: 3, max: 40 },
  rejectionReason: { min: 10, max: 1000 },
  approvalNote: { max: 500 },
} as const;

/** Uppercase letters/digits separated by single hyphens, e.g. FAB-ROLL-882. */
export const FABRIC_ROLL_ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
