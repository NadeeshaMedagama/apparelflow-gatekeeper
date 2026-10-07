import { requirePermission } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { listRecipes } from "@/server/services/recipes";

/** GET /api/recipes — production recipes (BOM) with their components. */
export const GET = apiRoute(async (request) => {
  const user = await requirePermission(request, "recipe:read");
  return ok(await listRecipes(user));
});
