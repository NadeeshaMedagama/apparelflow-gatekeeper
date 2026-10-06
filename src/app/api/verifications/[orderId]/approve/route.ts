import { approveBatchSchema } from "@/domain/validation";
import { requirePermission } from "@/server/auth/current-user";
import { parseJsonBody } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { approveBatch } from "@/server/services/verification";

/**
 * POST /api/verifications/:orderId/approve — the gatekeeper hard stop.
 *
 *   401  no / invalid session
 *   403  caller is not a Cutting Verifier
 *   404  unknown order
 *   409  order is not PENDING_VERIFICATION
 *   422  any component RED, missing or uncounted (VERIFICATION_GATE_BLOCKED)
 *
 * Optional body: { note }. Verifier identity and timestamp come from the
 * session and the database — never from the request.
 */
export const POST = apiRoute<{ orderId: string }>(async (request, { orderId }) => {
  const user = await requirePermission(request, "verification:decide");
  const input = await parseJsonBody(request, approveBatchSchema, { allowEmpty: true });
  return ok(await approveBatch(user, orderId, input));
});
