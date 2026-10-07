import { describe, expect, it } from "vitest";
import { countDecimalPlaces, divideRounded, fromScaledInteger, toScaledInteger } from "@/domain/decimal";
import { calculateExpectedFabricYards, calculateWastagePct, evaluateWastage } from "@/domain/wastage";

describe("fabric wastage", () => {
  it("follows the brief: [(actual − expected) ÷ expected] × 100", () => {
    // 50 × 1.8 = 90 expected; 92 used → 2.22 %
    expect(calculateExpectedFabricYards(50, "1.800")).toBe(90);
    expect(calculateWastagePct(50, "1.8", 92)).toBe(2.22);
    // 80 × 1.8 = 144; 150 used → 4.1666… → 4.17
    expect(calculateWastagePct(80, "1.8", 150)).toBe(4.17);
    // 120 × 1.1 = 132; 140.5 used → 6.4393… → 6.44
    expect(calculateWastagePct(120, "1.1", 140.5)).toBe(6.44);
  });

  it("reports savings as a negative percentage", () => {
    expect(calculateWastagePct(50, "1.8", 88.2)).toBe(-2);
  });

  it("rounds half away from zero without floating-point drift", () => {
    // 3 × 1.1 = 3.3 exactly (binary floats would give 3.3000000000000003)
    expect(calculateExpectedFabricYards(3, "1.1")).toBe(3.3);
    // (100.01 − 100) / 100 = 0.01 % ; (100.005…) not representable in input
    expect(calculateWastagePct(100, 1, 100.01)).toBe(0.01);
    // Exactly half a hundredth: 1/8 % = 0.125 → 0.13
    expect(calculateWastagePct(8, 1, 8.01)).toBe(0.13);
  });

  it("flags (but does not block) wastage above the recipe cap", () => {
    const result = evaluateWastage({ targetQty: 50, stdFabricYards: "1.8", actualFabricYds: 95, wastageCap: "5.00" });
    expect(result).toEqual({ expectedFabricYds: 90, actualFabricYds: 95, wastagePct: 5.56, wastageCap: 5, exceedsCap: true });
  });

  it("refuses impossible inputs", () => {
    expect(() => calculateWastagePct(0, "1.8", 10)).toThrow(RangeError);
    expect(() => calculateWastagePct(10, "0", 10)).toThrow(RangeError);
    expect(() => calculateWastagePct(10, "1.8", -1)).toThrow(RangeError);
  });
});

describe("exact decimal helpers", () => {
  it("scales decimals exactly", () => {
    expect(toScaledInteger("92.5", 2)).toBe(BigInt(9250));
    expect(toScaledInteger(0.1, 3)).toBe(BigInt(100));
    expect(fromScaledInteger(BigInt(-1234), 2)).toBe(-12.34);
    expect(() => toScaledInteger("1.234", 2)).toThrow(RangeError);
    expect(() => toScaledInteger("1e3", 2)).toThrow(RangeError);
  });

  it("counts decimal places of plain decimals only", () => {
    expect(countDecimalPlaces(92.5)).toBe(1);
    expect(countDecimalPlaces("92.50")).toBe(1);
    expect(countDecimalPlaces(3)).toBe(0);
    expect(countDecimalPlaces("abc")).toBeNaN();
  });

  it("divides with commercial rounding", () => {
    expect(divideRounded(BigInt(5), BigInt(2))).toBe(BigInt(3));
    expect(divideRounded(BigInt(-5), BigInt(2))).toBe(BigInt(-3));
    expect(divideRounded(BigInt(4), BigInt(3))).toBe(BigInt(1));
    expect(() => divideRounded(BigInt(1), BigInt(0))).toThrow(RangeError);
  });
});
