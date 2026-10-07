import { failure } from "@/server/http/respond";

/** Unknown API paths return the standard JSON error envelope instead of an HTML page. */
function notFound() {
  return failure(404, "ENDPOINT_NOT_FOUND", "No API endpoint exists at this path.");
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
