import { describe, expect, it } from "vitest";
import {
  createCuttingOrderSchema,
  fabricRollIdSchema,
  parseDecimalInput,
  parseWholeNumberInput,
  rejectBatchSchema,
  saveCountsSchema,
} from "@/domain/validation";

const RECIPE = "6a3f4f58-2d0c-4f5e-9d39-4b3c1f6b2a10";
const COMPONENT = "0b8f0a77-9c39-4f1f-8d8e-5a6c1b2d3e4f";

describe("API schemas reject unsafe numeric input", () => {
  const base = { recipeId: RECIPE, targetQty: 50, fabricRollId: "FAB-ROLL-882", actualFabricYds: 92 };

  it("accepts a valid order", () => {
    expect(createCuttingOrderSchema.safeParse(base).success).toBe(true);
  });

  it.each([-1, 0, 1.5, "50", "abc", " ", "", null, undefined, Number.NaN, Number.POSITIVE_INFINITY, true, [50]])(
    "rejects targetQty = %j",
    (targetQty) => {
      expect(createCuttingOrderSchema.safeParse({ ...base, targetQty }).success).toBe(false);
    },
  );

  it.each([-1, 0, "92", 92.555, null])("rejects actualFabricYds = %j", (actualFabricYds) => {
    expect(createCuttingOrderSchema.safeParse({ ...base, actualFabricYds }).success).toBe(false);
  });

  it("rejects unknown keys such as a client-supplied status", () => {
    const result = createCuttingOrderSchema.safeParse({ ...base, status: "VERIFIED" });
    expect(result.success).toBe(false);
  });

  it.each([-1, 2.5, "10", null, undefined])("rejects a component count of %j", (actualQty) => {
    expect(saveCountsSchema.safeParse({ items: [{ componentId: COMPONENT, actualQty }] }).success).toBe(false);
  });

  it("accepts zero as a legitimate (RED) physical count", () => {
    expect(saveCountsSchema.safeParse({ items: [{ componentId: COMPONENT, actualQty: 0 }] }).success).toBe(true);
  });

  it("requires a meaningful rejection reason", () => {
    expect(rejectBatchSchema.safeParse({}).success).toBe(false);
    expect(rejectBatchSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(rejectBatchSchema.safeParse({ reason: "short" }).success).toBe(false);
    const ok = rejectBatchSchema.safeParse({ reason: "  Cuffs short by 2 pieces  " });
    expect(ok.success && ok.data.reason).toBe("Cuffs short by 2 pieces");
  });

  it("normalises fabric roll ids", () => {
    expect(fabricRollIdSchema.parse(" fab-roll-882 ")).toBe("FAB-ROLL-882");
    expect(fabricRollIdSchema.safeParse("FAB--ROLL").success).toBe(false);
    expect(fabricRollIdSchema.safeParse("AB").success).toBe(false);
  });
});

describe("form input parsers give precise inline errors", () => {
  const qty = (raw: string) => parseWholeNumberInput(raw, { label: "Quantity", min: 1, max: 50_000 });

  it.each([
    ["", "Quantity is required"],
    ["   ", "Quantity is required"],
    ["-3", "Quantity cannot be negative"],
    ["1.5", "Quantity must be a whole number"],
    ["12,5", "Quantity must be a whole number"],
    ["abc", "Quantity must contain digits only"],
    ["1e3", "Quantity must contain digits only"],
    ["0", "Quantity must be at least 1"],
    ["50001", "Quantity cannot exceed 50,000"],
  ])("rejects %j with %j", (raw, message) => {
    expect(qty(raw)).toEqual({ ok: false, error: message });
  });

  it("accepts whole numbers with surrounding whitespace", () => {
    expect(qty(" 50 ")).toEqual({ ok: true, value: 50 });
  });

  it("parses fabric yards to two decimals", () => {
    const yards = (raw: string) => parseDecimalInput(raw, { label: "Fabric", min: 0.01, max: 1000, decimals: 2 });
    expect(yards("92.50")).toEqual({ ok: true, value: 92.5 });
    expect(yards("92.555")).toEqual({ ok: false, error: "Fabric can have at most 2 decimal places" });
    expect(yards("-1")).toEqual({ ok: false, error: "Fabric cannot be negative" });
    expect(yards("x")).toEqual({ ok: false, error: "Fabric must be a number (e.g. 92.5)" });
    expect(yards("0")).toEqual({ ok: false, error: "Fabric must be greater than 0" });
  });
});
