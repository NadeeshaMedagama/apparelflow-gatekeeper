import { permissionsFor } from "@/domain/roles";
import { authenticateRequest } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";

/** GET /api/auth/me — the authenticated user and their effective permissions. */
export const GET = apiRoute(async (request) => {
  const user = await authenticateRequest(request);
  return ok({ user, permissions: permissionsFor(user.role) });
});
