import { requirePermission } from "@/server/auth/current-user";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { getAssemblyInProgress } from "@/server/services/sewing";

/** GET /api/sewing/assembly — batches already released to the assembly line. */
export const GET = apiRoute(async (request) => {
  const user = await requirePermission(request, "sewing:read");
  return ok(await getAssemblyInProgress(user));
});
