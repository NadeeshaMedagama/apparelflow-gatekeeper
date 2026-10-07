import { requirePermission } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { getSewingBatch } from "@/server/services/sewing";

/** GET /api/sewing/queue/:orderId — a verified batch with its immutable approval record (404 otherwise). */
export const GET = apiRoute<{ orderId: string }>(async (request, { orderId }) => {
  const user = await requirePermission(request, "sewing:read");
  return ok(await getSewingBatch(user, orderId));
});
