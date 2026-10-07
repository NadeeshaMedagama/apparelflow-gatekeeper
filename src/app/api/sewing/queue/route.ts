import { requirePermission } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { getSewingQueue } from "@/server/services/sewing";

/**
 * GET /api/sewing/queue — verified batches only.
 * The status filter is fixed in the database query; query parameters such as
 * ?status=PENDING_VERIFICATION are deliberately ignored.
 */
export const GET = apiRoute(async (request) => {
  const user = await requirePermission(request, "sewing:read");
  return ok(await getSewingQueue(user));
});
