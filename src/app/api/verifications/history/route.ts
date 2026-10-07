import { z } from "zod";
import { requirePermission } from "@/server/auth/current-user";
import { parseWithSchema } from "@/server/http/request";
import { ok } from "@/server/http/respond";
import { apiRoute } from "@/server/http/route";
import { listDecisionHistory } from "@/server/services/verification";

const limitSchema = z
  .string()
  .regex(/^\d+$/, { error: "limit must be a whole number" })
  .transform(Number)
  .pipe(z.number().int().min(1, { error: "limit must be at least 1" }).max(200, { error: "limit cannot exceed 200" }));

/** GET /api/verifications/history?limit=50 — immutable QC decision log. */
export const GET = apiRoute(async (request) => {
  const user = await requirePermission(request, "verification:read");
  const rawLimit = request.nextUrl.searchParams.get("limit");
  const limit = rawLimit === null ? undefined : parseWithSchema(limitSchema, rawLimit);
  return ok(await listDecisionHistory(user, { limit }));
});
