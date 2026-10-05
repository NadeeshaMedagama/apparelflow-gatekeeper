import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Lazily-created Prisma client.
 *
 * Creation is deferred to first use so that `next build` (which imports route
 * modules) does not need a database connection. In development the client is
 * cached on globalThis so hot reloads do not leak connection pools.
 *
 * Pool sizing is controlled through the connection string, e.g.
 * `?connection_limit=1&pgbouncer=true` for serverless + a pooler.
 */

function createClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure a PostgreSQL connection.");
  }
  // Unexpected failures are logged once by the API error handler; expected
  // rejections (e.g. integrity guards firing) should not flood the logs.
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : process.env.NODE_ENV === "test" ? [] : ["warn"],
  });
}

const globalForPrisma = globalThis as typeof globalThis & { __apparelflowPrisma?: PrismaClient };
let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (client) return client;
  if (process.env.NODE_ENV === "development") {
    globalForPrisma.__apparelflowPrisma ??= createClient();
    client = globalForPrisma.__apparelflowPrisma;
  } else {
    client = createClient();
  }
  return client;
}

/** Releases the connection pool (tests and scripts). */
export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
