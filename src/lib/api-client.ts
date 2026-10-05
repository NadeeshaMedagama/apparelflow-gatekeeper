import type { ApiEnvelope } from "./dto";

/** Error raised for any non-success API envelope. Carries the server's stable error code. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** First validation message per top-level field, for inline form errors. */
  get fieldErrors(): Record<string, string> {
    const details = this.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined;
    const result: Record<string, string> = {};
    for (const [field, messages] of Object.entries(details?.fieldErrors ?? {})) {
      if (messages && messages.length > 0) result[field] = messages[0];
    }
    return result;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Typed fetch wrapper for the JSON envelope used by every API route. */
export async function apiRequest<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = options;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (!envelope) {
    throw new ApiRequestError(response.status, "INVALID_RESPONSE", `Unexpected server response (HTTP ${response.status}).`);
  }
  if (!envelope.success) {
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/login")) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiRequestError(response.status, envelope.error.code, envelope.error.message, envelope.error.details);
  }
  return envelope.data;
}
