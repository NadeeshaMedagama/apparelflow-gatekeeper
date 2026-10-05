import { describe, expect, it } from "vitest";
import { evaluateVerificationGate, summarizeGateFailure, type GateCount, type GateRequirement } from "@/domain/gate";

const requirements: GateRequirement[] = [
  { componentId: "front", componentName: "Front Body Panel", expectedQty: 50 },
  { componentId: "sleeves", componentName: "Sleeves", expectedQty: 100 },
  { componentId: "cuffs", componentName: "Sleeve Cuffs", expectedQty: 100 },
];

const sheet = (actual: Record<string, number | null>): GateCount[] =>
  requirements.map((requirement) => ({
    componentId: requirement.componentId,
    expectedQty: requirement.expectedQty,
    actualQty: requirement.componentId in actual ? actual[requirement.componentId]! : requirement.expectedQty,
  }));

describe("verification gate (hard stop)", () => {
  it("passes when every component is counted with no shortage", () => {
    const result = evaluateVerificationGate(requirements, sheet({}));
    expect(result.passed).toBe(true);
    expect(result.totals).toMatchObject({ required: 3, counted: 3, green: 3, red: 0 });
  });

  it("lets surplus (YELLOW) through", () => {
    const result = evaluateVerificationGate(requirements, sheet({ sleeves: 104 }));
    expect(result.passed).toBe(true);
    expect(result.totals.yellow).toBe(1);
  });

  it("blocks on a single shortage", () => {
    const result = evaluateVerificationGate(requirements, sheet({ cuffs: 98 }));
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([expect.objectContaining({ code: "SHORTAGE", componentId: "cuffs", actualQty: 98 })]);
    expect(summarizeGateFailure(result)).toBe("Approval blocked: batch has 1 shortage component.");
  });

  it("blocks on an uncounted component", () => {
    const result = evaluateVerificationGate(requirements, sheet({ front: null }));
    expect(result.passed).toBe(false);
    expect(result.violations.map((violation) => violation.code)).toEqual(["UNCOUNTED_COMPONENT"]);
  });

  it("blocks when a required component has no count sheet entry", () => {
    const result = evaluateVerificationGate(requirements, sheet({}).slice(0, 2));
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual([expect.objectContaining({ code: "MISSING_COMPONENT", componentId: "cuffs" })]);
  });

  it("measures counts against the recipe, not a tampered sheet expectation", () => {
    const tampered = sheet({ cuffs: 10 }).map((count) => (count.componentId === "cuffs" ? { ...count, expectedQty: 10 } : count));
    const result = evaluateVerificationGate(requirements, tampered);
    expect(result.passed).toBe(false);
    expect(result.violations.map((violation) => violation.code).sort()).toEqual(["EXPECTED_QTY_MISMATCH", "SHORTAGE"]);
  });

  it("rejects duplicate and unknown components and empty recipes", () => {
    const duplicate = evaluateVerificationGate(requirements, [...sheet({}), { componentId: "front", expectedQty: 50, actualQty: 50 }]);
    expect(duplicate.violations.map((violation) => violation.code)).toContain("DUPLICATE_COMPONENT");

    const unknown = evaluateVerificationGate(requirements, [...sheet({}), { componentId: "pocket", expectedQty: 5, actualQty: 5 }]);
    expect(unknown.violations.map((violation) => violation.code)).toContain("UNKNOWN_COMPONENT");

    expect(evaluateVerificationGate([], []).passed).toBe(false);
  });
});
