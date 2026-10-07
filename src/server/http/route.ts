import "server-only";
import type { NextRequest } from "next/server";
import { errorResponse } from "./respond";
import { assertSameOrigin } from "./request";

type RouteParams = Record<string, string | string[]>;

/**
 * Wraps a Route Handler with the cross-cutting API policy:
 * same-origin enforcement for unsafe methods and uniform error envelopes.
 * Authentication and authorization are performed explicitly inside each
 * handler so the guard is visible next to the business action it protects.
 */
export function apiRoute<P extends RouteParams = Record<string, never>>(
  handler: (request: NextRequest, params: P) => Promise<Response>,
) {
  return async (request: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      assertSameOrigin(request);
      const params = await context.params;
      return await handler(request, params);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
