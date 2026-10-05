import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/server/auth/session";
import type { AuthUser } from "@/server/auth/current-user";

type RouteHandler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  /** Authenticated caller; omitted = anonymous request. */
  as?: Pick<AuthUser, "id" | "role">;
  /** JSON body (serialised). Use `rawBody` to send malformed payloads. */
  body?: unknown;
  rawBody?: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  cookie?: string;
}

export interface CallResult<T = unknown> {
  status: number;
  headers: Headers;
  json: {
    success: boolean;
    data: T;
    error: { code: string; message: string; details?: Record<string, unknown> };
  };
}

/**
 * Invokes a Route Handler in-process with a real NextRequest and a real signed
 * session cookie, exercising authentication, RBAC, validation and the database.
 */
export async function call<T = unknown>(handler: unknown, options: CallOptions = {}): Promise<CallResult<T>> {
  const method = options.method ?? (options.body !== undefined || options.rawBody !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined || options.rawBody !== undefined) headers["content-type"] = "application/json";
  if (options.as) headers.cookie = `${SESSION_COOKIE}=${await createSessionToken(options.as)}`;
  if (options.cookie) headers.cookie = options.cookie;

  const request = new NextRequest(new URL(options.path ?? "/api/test", "http://localhost:3000"), {
    method,
    headers,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const response = await (handler as RouteHandler)(request, { params: Promise.resolve(options.params ?? {}) });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    json: text ? JSON.parse(text) : ({} as CallResult<T>["json"]),
  };
}
