import { updateCuttingOrderSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { getCuttingOrder, updateCuttingOrder } from "@/server/services/cutting-orders";

/** GET /api/cutting-orders/:id — order detail with count sheet, audit logs and timeline. */
export const GET = apiRoute<{ id: string }>(async (request, { id }) => {
  const user = await requirePermission(request, "order:read");
  return ok(await getCuttingOrder(user, id));
});

/**
 * PATCH /api/cutting-orders/:id — edit quantity / fabric while CUTTING_IN_PROGRESS.
 * Status is not an accepted field: transitions only happen through action endpoints.
 */
export const PATCH = apiRoute<{ id: string }>(async (request, { id }) => {
  const user = await requirePermission(request, "order:update");
  const input = await parseJsonBody(request, updateCuttingOrderSchema);
  return ok(await updateCuttingOrder(user, id, input));
});
