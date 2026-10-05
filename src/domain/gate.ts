import { classifyComponentCount, countVariance, type ComponentStatus } from "./traffic-light";

/**
 * Gatekeeper hard stop.
 *
 * A batch may only be approved when EVERY component required by the recipe has
 * a count sheet entry, has been physically counted, and is not short. This
 * pure function is the single implementation of that rule; the approval
 * service calls it inside the approval transaction and the verifier terminal
 * calls it to drive the UI (where it is only a convenience, never a boundary).
 */

export type GateViolationCode =
  | "EMPTY_RECIPE"
  | "MISSING_COMPONENT"
  | "UNCOUNTED_COMPONENT"
  | "SHORTAGE"
  | "EXPECTED_QTY_MISMATCH"
  | "UNKNOWN_COMPONENT"
  | "DUPLICATE_COMPONENT";

export interface GateRequirement {
  componentId: string;
  componentName: string;
  /** Recipe-derived expectation: target quantity × pieces per garment. */
  expectedQty: number;
}

export interface GateCount {
  componentId: string;
  /** Expected quantity stored on the count sheet when the batch was submitted. */
  expectedQty: number;
  actualQty: number | null;
}

export interface GateViolation {
  code: GateViolationCode;
  message: string;
  componentId?: string;
  componentName?: string;
  expectedQty?: number;
  actualQty?: number | null;
}

export type GateComponentState = ComponentStatus | "UNCOUNTED" | "MISSING";

export interface GateComponentResult {
  componentId: string;
  componentName: string;
  expectedQty: number;
  actualQty: number | null;
  variance: number | null;
  state: GateComponentState;
}

export interface GateTotals {
  required: number;
  counted: number;
  green: number;
  yellow: number;
  red: number;
  uncounted: number;
  missing: number;
}

export interface GateEvaluation {
  passed: boolean;
  totals: GateTotals;
  components: GateComponentResult[];
  violations: GateViolation[];
}

export function evaluateVerificationGate(
  requirements: readonly GateRequirement[],
  counts: readonly GateCount[],
): GateEvaluation {
  const violations: GateViolation[] = [];
  const components: GateComponentResult[] = [];
  const totals: GateTotals = {
    required: requirements.length,
    counted: 0,
    green: 0,
    yellow: 0,
    red: 0,
    uncounted: 0,
    missing: 0,
  };

  if (requirements.length === 0) {
    violations.push({
      code: "EMPTY_RECIPE",
      message: "The recipe defines no components, so the batch cannot be verified.",
    });
  }

  const countsById = new Map<string, GateCount>();
  for (const count of counts) {
    if (countsById.has(count.componentId)) {
      violations.push({
        code: "DUPLICATE_COMPONENT",
        componentId: count.componentId,
        message: `Component ${count.componentId} appears more than once on the count sheet.`,
      });
      continue;
    }
    countsById.set(count.componentId, count);
  }

  const requiredIds = new Set<string>();
  for (const requirement of requirements) {
    requiredIds.add(requirement.componentId);
    const count = countsById.get(requirement.componentId);
    const base = {
      componentId: requirement.componentId,
      componentName: requirement.componentName,
      expectedQty: requirement.expectedQty,
    };

    if (!count) {
      totals.missing += 1;
      components.push({ ...base, actualQty: null, variance: null, state: "MISSING" });
      violations.push({
        ...base,
        code: "MISSING_COMPONENT",
        actualQty: null,
        message: `${requirement.componentName} is missing from the count sheet.`,
      });
      continue;
    }

    if (count.expectedQty !== requirement.expectedQty) {
      violations.push({
        ...base,
        code: "EXPECTED_QTY_MISMATCH",
        actualQty: count.actualQty,
        message: `${requirement.componentName}: count sheet expects ${count.expectedQty} but the recipe requires ${requirement.expectedQty}. Resubmit the batch to regenerate the count sheet.`,
      });
    }

    if (count.actualQty === null) {
      totals.uncounted += 1;
      components.push({ ...base, actualQty: null, variance: null, state: "UNCOUNTED" });
      violations.push({
        ...base,
        code: "UNCOUNTED_COMPONENT",
        actualQty: null,
        message: `${requirement.componentName} has not been counted.`,
      });
      continue;
    }

    totals.counted += 1;
    const state = classifyComponentCount(requirement.expectedQty, count.actualQty);
    const variance = countVariance(requirement.expectedQty, count.actualQty);
    components.push({ ...base, actualQty: count.actualQty, variance, state });

    if (state === "GREEN") totals.green += 1;
    if (state === "YELLOW") totals.yellow += 1;
    if (state === "RED") {
      totals.red += 1;
      violations.push({
        ...base,
        code: "SHORTAGE",
        actualQty: count.actualQty,
        message: `${requirement.componentName} is short by ${-variance} (counted ${count.actualQty} of ${requirement.expectedQty}).`,
      });
    }
  }

  for (const count of countsById.values()) {
    if (!requiredIds.has(count.componentId)) {
      violations.push({
        code: "UNKNOWN_COMPONENT",
        componentId: count.componentId,
        actualQty: count.actualQty,
        message: `Component ${count.componentId} is not part of this recipe.`,
      });
    }
  }

  return { passed: violations.length === 0, totals, components, violations };
}

/** One-line human summary of why a gate evaluation failed. */
export function summarizeGateFailure(evaluation: GateEvaluation): string {
  const { totals } = evaluation;
  const parts: string[] = [];
  if (totals.red > 0) parts.push(`${totals.red} shortage component${totals.red === 1 ? "" : "s"}`);
  if (totals.missing > 0) parts.push(`${totals.missing} missing component${totals.missing === 1 ? "" : "s"}`);
  if (totals.uncounted > 0) parts.push(`${totals.uncounted} uncounted component${totals.uncounted === 1 ? "" : "s"}`);
  const other = evaluation.violations.filter(
    (violation) => !["SHORTAGE", "MISSING_COMPONENT", "UNCOUNTED_COMPONENT"].includes(violation.code),
  ).length;
  if (other > 0) parts.push(`${other} count sheet integrity issue${other === 1 ? "" : "s"}`);
  return parts.length > 0
    ? `Approval blocked: batch has ${parts.join(", ")}.`
    : "Approval blocked by the verification gate.";
}
