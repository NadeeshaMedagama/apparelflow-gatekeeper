import { emptyActionSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { startSewingAssembly } from "@/server/services/sewing";

/** POST /api/sewing/queue/:orderId/start — VERIFIED → SEWING_IN_PROGRESS. */
export const POST = apiRoute<{ orderId: string }>(async (request, { orderId }) => {
  const user = await requirePermission(request, "sewing:start");
  await parseJsonBody(request, emptyActionSchema, { allowEmpty: true });
  return ok(await startSewingAssembly(user, orderId));
});
