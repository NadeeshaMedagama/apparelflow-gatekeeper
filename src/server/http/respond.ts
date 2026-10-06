import "server-only";
import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/dto";
import { AppError } from "./errors";
import { translateDatabaseError } from "./database-errors";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status, headers: NO_STORE });
}

export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return ok(data, 201);
}

export function failure(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiFailure> {
  const body: ApiFailure = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function errorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    return failure(error.status, error.code, error.message, error.details);
  }

  const translated = translateDatabaseError(error);
  if (translated) {
    return failure(translated.status, translated.code, translated.message, translated.details);
  }

  // Unknown failure: log the detail server-side, never leak internals to the client.
  console.error("[api] Unhandled error", error);
  return failure(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again.");
}
