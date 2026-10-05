import "server-only";
import { AppError } from "./errors";

/**
 * Maps database-level rejections to API errors.
 *
 * Under normal operation the domain services reject bad requests before they
 * reach the database. These translations matter when a defence-in-depth guard
 * fires anyway (a CHECK constraint, a state-machine trigger, a unique key under
 * a race) — the client still gets a clean 409/422 rather than a raw 500.
 */

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  meta?: Record<string, unknown>;
  cause?: unknown;
}

const TRIGGER_MARKERS = ["Gatekeeper hard stop", "Illegal cutting order transition", "append-only", "count sheet is locked", "is locked"];

function collectMessages(error: unknown, depth = 0): string[] {
  if (!error || typeof error !== "object" || depth > 4) return [];
  const candidate = error as ErrorLike;
  const own = typeof candidate.message === "string" ? [candidate.message] : [];
  const meta = candidate.meta ? Object.values(candidate.meta).filter((value): value is string => typeof value === "string") : [];
  return [...own, ...meta, ...collectMessages(candidate.cause, depth + 1)];
}

export function translateDatabaseError(error: unknown): AppError | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as ErrorLike;
  const code = typeof candidate.code === "string" ? candidate.code : undefined;
  const messages = collectMessages(error);
  const joined = messages.join(" | ");

  if (TRIGGER_MARKERS.some((marker) => joined.includes(marker))) {
    return new AppError(
      409,
      "INTEGRITY_GUARD_REJECTED",
      "The database integrity guard rejected this change. Reload the batch and try again.",
    );
  }

  switch (code) {
    case "P2002":
      return new AppError(409, "DUPLICATE_RECORD", "A record with the same unique value already exists.");
    case "P2025":
      return new AppError(404, "NOT_FOUND", "The requested resource was not found.");
    case "P2003":
      return new AppError(422, "INVALID_REFERENCE", "The request references a record that does not exist.");
    case "P2004":
    case "P2011":
      return new AppError(422, "CONSTRAINT_VIOLATION", "The data violates a database constraint.");
    default:
      return null;
  }
}
