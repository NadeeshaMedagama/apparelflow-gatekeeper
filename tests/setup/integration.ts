import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll } from "vitest";
import { disconnectPrisma } from "@/server/db";
import { adminUrl, baseDatabaseName, quoteIdent, templateDatabaseName, testDatabaseUrl, withDatabase } from "./database-urls";

/**
 * Per-test-file isolation: clone the migrated template into a fresh database
 * and point the application's Prisma client at it before any test runs.
 */
const base = testDatabaseUrl();
const database = `${baseDatabaseName(base)}_${process.pid}_${randomBytes(4).toString("hex")}`;

const admin = new PrismaClient({ datasourceUrl: adminUrl(base) });
await admin.$executeRawUnsafe(`CREATE DATABASE ${quoteIdent(database)} TEMPLATE ${quoteIdent(templateDatabaseName(base))}`);
await admin.$disconnect();

process.env.DATABASE_URL = withDatabase(base, database);
process.env.AUTH_SECRET = "integration-test-secret-0123456789abcdefghijklmnop";

afterAll(async () => {
  await disconnectPrisma();
  const cleanup = new PrismaClient({ datasourceUrl: adminUrl(base) });
  try {
    await cleanup.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${quoteIdent(database)} WITH (FORCE)`);
  } finally {
    await cleanup.$disconnect();
  }
});
