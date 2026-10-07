import { requirePermission } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { getVerificationSheet } from "@/server/services/verification";

/** GET /api/verifications/:orderId — count sheet, live gate verdict and decision history. */
export const GET = apiRoute<{ orderId: string }>(async (request, { orderId }) => {
  const user = await requirePermission(request, "verification:read");
  return ok(await getVerificationSheet(user, orderId));
});
