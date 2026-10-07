import { saveCountsSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { saveComponentCounts } from "@/server/services/verification";

/**
 * PUT /api/verifications/:orderId/items — record physical counts.
 * Body: { items: [{ componentId, actualQty }] }. Traffic-light status is
 * computed by the server; a client-supplied "status" is rejected.
 */
export const PUT = apiRoute<{ orderId: string }>(async (request, { orderId }) => {
  const user = await requirePermission(request, "verification:count");
  const input = await parseJsonBody(request, saveCountsSchema);
  return ok(await saveComponentCounts(user, orderId, input));
});
