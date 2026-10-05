/**
 * Exact decimal helpers for fabric measurements and percentages.
 *
 * Fabric yards and wastage percentages are persisted as audit data, so they are
 * computed with scaled integers (BigInt) rather than binary floating point.
 * `0.1 + 0.2 !== 0.3` must never leak into a permanent record.
 */

const PLAIN_DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

function toPlainString(value: number | string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(`Expected a finite number, received ${value}`);
    }
    return String(value);
  }
  return value.trim();
}

/** Number of digits after the decimal point; NaN when the value is not a plain decimal. */
export function countDecimalPlaces(value: number | string): number {
  let text: string;
  try {
    text = toPlainString(value);
  } catch {
    return Number.NaN;
  }
  const match = PLAIN_DECIMAL.exec(text);
  if (!match) return Number.NaN;
  return (match[3] ?? "").replace(/0+$/, "").length;
}

/**
 * Converts a decimal to an integer scaled by 10^scale, exactly.
 * `toScaledInteger("92.5", 2) === 9250n`. Throws if the value carries more
 * precision than `scale` allows or is not a plain decimal (e.g. "1e+21").
 */
export function toScaledInteger(value: number | string, scale: number): bigint {
  const text = toPlainString(value);
  const match = PLAIN_DECIMAL.exec(text);
  if (!match) {
    throw new RangeError(`"${text}" is not a plain decimal number`);
  }
  const [, sign, whole, rawFraction = ""] = match;
  const fraction = rawFraction.replace(/0+$/, "");
  if (fraction.length > scale) {
    throw new RangeError(`"${text}" has more than ${scale} decimal places`);
  }
  const digits = `${whole}${fraction.padEnd(scale, "0")}`;
  const magnitude = BigInt(digits);
  return sign ? -magnitude : magnitude;
}

/** Inverse of {@link toScaledInteger}; safe for the magnitudes used in this domain. */
export function fromScaledInteger(value: bigint, scale: number): number {
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return Number(`${negative ? "-" : ""}${whole}${scale > 0 ? `.${fraction}` : ""}`);
}

/** Integer division rounded half away from zero (commercial rounding). */
export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const zero = BigInt(0);
  if (denominator === zero) {
    throw new RangeError("Division by zero");
  }
  const negative = numerator < zero !== denominator < zero;
  const n = numerator < zero ? -numerator : numerator;
  const d = denominator < zero ? -denominator : denominator;
  let quotient = n / d;
  const remainder = n % d;
  if (remainder * BigInt(2) >= d) {
    quotient += BigInt(1);
  }
  return negative ? -quotient : quotient;
}
