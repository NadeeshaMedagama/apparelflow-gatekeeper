/**
 * Multiplier engine: derives expected cut-part counts from a recipe (BOM).
 *
 *   expected pieces = target batch quantity × pieces per garment
 *   e.g. 50 garments × 2 sleeve cuffs = 100 cut cuffs expected
 */

export interface PiecesPerGarment {
  piecesPerGarment: number;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive whole number, received ${value}`);
  }
}

export function calculateExpectedQuantity(targetQty: number, piecesPerGarment: number): number {
  assertPositiveInteger(targetQty, "Target batch quantity");
  assertPositiveInteger(piecesPerGarment, "Pieces per garment");
  const expected = targetQty * piecesPerGarment;
  if (!Number.isSafeInteger(expected)) {
    throw new RangeError("Expected component quantity exceeds the supported range");
  }
  return expected;
}

export function calculateExpectedComponents<T extends PiecesPerGarment>(
  targetQty: number,
  components: readonly T[],
): Array<T & { expectedQty: number }> {
  return components.map((component) => ({
    ...component,
    expectedQty: calculateExpectedQuantity(targetQty, component.piecesPerGarment),
  }));
}

export function totalPiecesPerGarment(components: readonly PiecesPerGarment[]): number {
  return components.reduce((sum, component) => sum + component.piecesPerGarment, 0);
}
