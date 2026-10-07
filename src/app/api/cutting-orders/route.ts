import { createCuttingOrderSchema, orderStatusFilterSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody, parseWithSchema } from "@/server/http/request";
import { created, ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { createCuttingOrder, listCuttingOrders } from "@/server/services/cutting-orders";

/** GET /api/cutting-orders?status=PENDING_VERIFICATION — Cutting Supervisor's order board. */
export const GET = apiRoute(async (request) => {
  const user = await requirePermission(request, "order:read");
  const rawStatus = request.nextUrl.searchParams.get("status");
  const status = rawStatus === null ? undefined : parseWithSchema(orderStatusFilterSchema, rawStatus);
  return ok(await listCuttingOrders(user, { status }));
});

/**
 * POST /api/cutting-orders — create a cutting order from a recipe.
 * Body: { recipeId, targetQty, fabricRollId, actualFabricYds, submitForVerification? }
 */
export const POST = apiRoute(async (request) => {
  const user = await requirePermission(request, "order:create");
  const input = await parseJsonBody(request, createCuttingOrderSchema);
  return created(await createCuttingOrder(user, input));
});
