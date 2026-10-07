import { ROLE_PROFILES } from "@/domain/roles";
import { loginSchema } from "@/domain/validation";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { isSecureRequest, parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { authenticateCredentials } from "@/server/services/auth";

/** POST /api/auth/login — exchanges credentials for an HttpOnly session cookie. */
export const POST = apiRoute(async (request) => {
  const input = await parseJsonBody(request, loginSchema);
  const user = await authenticateCredentials(input);
  const token = await createSessionToken(user);

  const response = ok({ user, redirectTo: ROLE_PROFILES[user.role].home });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(isSecureRequest(request)));
  return response;
});
