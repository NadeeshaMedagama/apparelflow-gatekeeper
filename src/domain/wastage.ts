import { divideRounded, fromScaledInteger, toScaledInteger } from "./decimal";

/**
 * Fabric wastage analytics.
 *
 *   Expected Fabric   = Target Quantity × Standard Fabric Yards per garment
 *   Fabric Wastage %  = [(Actual Fabric Used − Expected Fabric) ÷ Expected Fabric] × 100
 *
 * Computed with exact scaled integers: yards to 3 decimal places, the
 * percentage rounded half away from zero to 2 decimal places. A negative
 * percentage means the batch used less fabric than the standard.
 */

const YARD_SCALE = 3;
const PERCENT_SCALE = 2;

export type DecimalInput = number | string;

export interface WastageInput {
  targetQty: number;
  stdFabricYards: DecimalInput;
  actualFabricYds: DecimalInput;
  /** Recipe wastage cap in percent (5 = 5%). */
  wastageCap: DecimalInput;
}

export interface WastageResult {
  expectedFabricYds: number;
  actualFabricYds: number;
  wastagePct: number;
  wastageCap: number;
  /** Operational warning only — the brief does not make the cap a hard stop. */
  exceedsCap: boolean;
}

function assertTargetQty(targetQty: number): void {
  if (!Number.isSafeInteger(targetQty) || targetQty <= 0) {
    throw new RangeError(`Target quantity must be a positive whole number, received ${targetQty}`);
  }
}

export function calculateExpectedFabricYards(targetQty: number, stdFabricYards: DecimalInput): number {
  assertTargetQty(targetQty);
  const std = toScaledInteger(stdFabricYards, YARD_SCALE);
  if (std <= BigInt(0)) {
    throw new RangeError("Standard fabric yards must be greater than zero");
  }
  return fromScaledInteger(std * BigInt(targetQty), YARD_SCALE);
}

export function calculateWastagePct(
  targetQty: number,
  stdFabricYards: DecimalInput,
  actualFabricYds: DecimalInput,
): number {
  assertTargetQty(targetQty);
  const expected = toScaledInteger(stdFabricYards, YARD_SCALE) * BigInt(targetQty);
  if (expected <= BigInt(0)) {
    throw new RangeError("Expected fabric must be greater than zero");
  }
  const actual = toScaledInteger(actualFabricYds, YARD_SCALE);
  if (actual < BigInt(0)) {
    throw new RangeError("Actual fabric used cannot be negative");
  }
  // ((actual − expected) / expected) × 100, expressed in hundredths of a percent.
  const hundredthsOfPercent = divideRounded((actual - expected) * BigInt(100 * 10 ** PERCENT_SCALE), expected);
  return fromScaledInteger(hundredthsOfPercent, PERCENT_SCALE);
}

export function evaluateWastage(input: WastageInput): WastageResult {
  const wastagePct = calculateWastagePct(input.targetQty, input.stdFabricYards, input.actualFabricYds);
  const wastageCap = fromScaledInteger(toScaledInteger(input.wastageCap, PERCENT_SCALE), PERCENT_SCALE);
  return {
    expectedFabricYds: calculateExpectedFabricYards(input.targetQty, input.stdFabricYards),
    actualFabricYds: fromScaledInteger(toScaledInteger(input.actualFabricYds, YARD_SCALE), YARD_SCALE),
    wastagePct,
    wastageCap,
    exceedsCap: wastagePct > wastageCap,
  };
}
