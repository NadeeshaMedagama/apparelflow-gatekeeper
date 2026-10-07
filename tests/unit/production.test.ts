import { describe, expect, it } from "vitest";
import { calculateExpectedComponents, calculateExpectedQuantity, totalPiecesPerGarment } from "@/domain/production";
import { classifyComponentCount, countVariance } from "@/domain/traffic-light";

const CASUAL_BLOUSE = [
  { id: "front", piecesPerGarment: 1 },
  { id: "back", piecesPerGarment: 1 },
  { id: "sleeves", piecesPerGarment: 2 },
  { id: "collar", piecesPerGarment: 1 },
  { id: "cuffs", piecesPerGarment: 2 },
];

describe("multiplier engine", () => {
  it("derives expected pieces as batch quantity × pieces per garment", () => {
    expect(calculateExpectedQuantity(50, 2)).toBe(100);
    expect(calculateExpectedComponents(50, CASUAL_BLOUSE).map((component) => component.expectedQty)).toEqual([50, 50, 100, 50, 100]);
    expect(totalPiecesPerGarment(CASUAL_BLOUSE)).toBe(7);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects an invalid batch quantity (%s)", (qty) => {
    expect(() => calculateExpectedQuantity(qty, 2)).toThrow(RangeError);
  });

  it("rejects an invalid pieces-per-garment value", () => {
    expect(() => calculateExpectedQuantity(10, 0)).toThrow(RangeError);
  });
});

describe("traffic-light status matrix", () => {
  it("is GREEN on an exact match, YELLOW on excess and RED on shortage", () => {
    expect(classifyComponentCount(100, 100)).toBe("GREEN");
    expect(classifyComponentCount(100, 101)).toBe("YELLOW");
    expect(classifyComponentCount(100, 99)).toBe("RED");
    expect(classifyComponentCount(100, 0)).toBe("RED");
  });

  it("reports signed variance", () => {
    expect(countVariance(100, 98)).toBe(-2);
    expect(countVariance(50, 52)).toBe(2);
  });

  it.each([-1, 1.5, Number.NaN])("refuses to classify an impossible count (%s)", (actual) => {
    expect(() => classifyComponentCount(100, actual)).toThrow(RangeError);
  });
});
