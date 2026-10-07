import { emptyActionSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { submitForVerification } from "@/server/services/cutting-orders";

/** POST /api/cutting-orders/:id/submit — CUTTING_IN_PROGRESS → PENDING_VERIFICATION. */
export const POST = apiRoute<{ id: string }>(async (request, { id }) => {
  const user = await requirePermission(request, "order:submit");
  await parseJsonBody(request, emptyActionSchema, { allowEmpty: true });
  return ok(await submitForVerification(user, id));
});
