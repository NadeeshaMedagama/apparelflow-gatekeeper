import { requirePermission } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { getRecipe } from "@/server/services/recipes";

/** GET /api/recipes/:id */
export const GET = apiRoute<{ id: string }>(async (request, { id }) => {
  const user = await requirePermission(request, "recipe:read");
  return ok(await getRecipe(user, id));
});
