import { requirePermission } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { listPendingVerifications } from "@/server/services/verification";

/** GET /api/verifications/pending — batches waiting at the QC station (FIFO). */
export const GET = apiRoute(async (request) => {
  const user = await requirePermission(request, "verification:read");
  return ok(await listPendingVerifications(user));
});
