import { rejectBatchSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { rejectBatch } from "@/server/services/verification";

/**
 * POST /api/verifications/:orderId/reject — return the batch to the Cutting Supervisor.
 * Body: { reason (mandatory, ≥ 10 chars), category? }. Missing reason → 422.
 */
export const POST = apiRoute<{ orderId: string }>(async (request, { orderId }) => {
  const user = await requirePermission(request, "verification:decide");
  const input = await parseJsonBody(request, rejectBatchSchema);
  return ok(await rejectBatch(user, orderId, input));
});
