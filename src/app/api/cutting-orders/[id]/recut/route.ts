import { emptyActionSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { startRecut } from "@/server/services/cutting-orders";

/** POST /api/cutting-orders/:id/recut — REJECTED → CUTTING_IN_PROGRESS (start re-cut). */
export const POST = apiRoute<{ id: string }>(async (request, { id }) => {
  const user = await requirePermission(request, "order:recut");
  await parseJsonBody(request, emptyActionSchema, { allowEmpty: true });
  return ok(await startRecut(user, id));
});
