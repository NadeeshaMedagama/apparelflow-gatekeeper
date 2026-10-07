import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { isSecureRequest } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";

/** POST /api/auth/logout — clears the session cookie. */
export const POST = apiRoute(async (request) => {
  const response = ok({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(isSecureRequest(request)), maxAge: 0 });
  return response;
});
