/**
 * Deterministic formatters. Dates are rendered in the plant's time zone with a
 * fixed month table so server and browser output are byte-identical (no
 * hydration mismatches from differing ICU data).
 */

export const PLANT_TIME_ZONE = process.env.NEXT_PUBLIC_PLANT_TIMEZONE || "Asia/Colombo";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PLANT_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function plantParts(iso: string) {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(new Date(iso))) parts[part.type] = part.value;
  return {
    year: parts.year ?? "",
    month: MONTHS[Number(parts.month) - 1] ?? "",
    day: (parts.day ?? "").padStart(2, "0"),
    hour: (parts.hour ?? "").padStart(2, "0"),
    minute: (parts.minute ?? "").padStart(2, "0"),
    second: (parts.second ?? "").padStart(2, "0"),
  };
}

/** "04 Oct 2026, 16:42" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = plantParts(iso);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** "04 Oct 2026, 16:42:18" — audit precision. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = plantParts(iso);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}:${p.second}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = plantParts(iso);
  return `${p.day} ${p.month} ${p.year}`;
}

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const yardsFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatYards(value: number): string {
  return `${yardsFormatter.format(value)} yd`;
}

/** "+2.22%", "−1.50%", "0.00%" (true minus sign for legibility). */
export function formatPercent(value: number, options: { signed?: boolean } = {}): string {
  const magnitude = yardsFormatter.format(Math.abs(value));
  if (value < 0) return `−${magnitude}%`;
  return `${options.signed && value > 0 ? "+" : ""}${magnitude}%`;
}

/** "+2", "−6", "0" */
export function formatVariance(value: number | null): string {
  if (value === null) return "—";
  if (value > 0) return `+${integerFormatter.format(value)}`;
  if (value < 0) return `−${integerFormatter.format(Math.abs(value))}`;
  return "0";
}
