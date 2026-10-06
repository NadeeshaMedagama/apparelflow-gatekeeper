import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { uuidSchema } from "@/domain/validation";
import { BadRequestError, ForbiddenError, NotFoundError, PayloadTooLargeError, ValidationError } from "./errors";

const MAX_BODY_BYTES = 64 * 1024;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Defence-in-depth CSRF guard. Session cookies are SameSite=Lax, which already
 * stops cross-site form posts; additionally, any browser request that carries
 * an Origin header must come from this host. Non-browser clients such as
 * cURL/Postman send no Origin and are authenticated by the cookie alone.
 */
export function assertSameOrigin(request: NextRequest): void {
  if (!UNSAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin === null) return;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (!host || originHost !== host) {
    throw new ForbiddenError("Cross-origin request rejected.", { reason: "ORIGIN_MISMATCH" });
  }
}

async function readJsonBody(request: NextRequest, allowEmpty: boolean): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) throw new PayloadTooLargeError();

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  if (text.trim() === "") {
    if (allowEmpty) return {};
    throw new ValidationError("Request body is required.", {
      formErrors: ["Request body is required."],
      fieldErrors: {},
      issues: [],
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequestError("Request body must be valid JSON.");
  }
}

export function validationDetails(error: z.ZodError) {
  const flattened = z.flattenError(error);
  return {
    formErrors: flattened.formErrors,
    fieldErrors: flattened.fieldErrors,
    issues: error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })),
  };
}

export function parseWithSchema<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const message = first
      ? `${first.path.length > 0 ? `${first.path.map(String).join(".")}: ` : ""}${first.message}`
      : "The request contains invalid data.";
    throw new ValidationError(message, validationDetails(result.error));
  }
  return result.data;
}

export async function parseJsonBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
  options: { allowEmpty?: boolean } = {},
): Promise<z.output<T>> {
  const body = await readJsonBody(request, options.allowEmpty ?? false);
  return parseWithSchema(schema, body);
}

/** True when the client reached us over HTTPS (directly or via a TLS-terminating proxy). */
export function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}

/** Route ids are UUIDs; anything else cannot exist, so it is reported as 404. */
export function parseResourceId(value: string, message = "The requested resource was not found."): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new NotFoundError(message);
  return result.data;
}
