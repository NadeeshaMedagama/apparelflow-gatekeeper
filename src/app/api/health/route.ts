import { getPrisma } from "@/server/db";
import { failure, ok } from "@/server/http/respond";

/** GET /api/health — liveness + database connectivity probe for deployments. */
export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return ok({ status: "ok", database: "up", time: new Date().toISOString() });
  } catch (error) {
    console.error("[health] database check failed", error);
    return failure(503, "SERVICE_UNAVAILABLE", "Database is unreachable.");
  }
}
