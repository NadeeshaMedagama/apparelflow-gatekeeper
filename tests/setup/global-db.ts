import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedReferenceData } from "../../prisma/seed-data";
import { DEMO_PASSWORD } from "../../src/lib/demo-accounts";
import { adminUrl, quoteIdent, templateDatabaseName, testDatabaseUrl, withDatabase } from "./database-urls";

/** Repository root — Prisma resolves prisma.config.ts and the schema from here. */
const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Builds a template database once per run: real migrations (including the
 * integrity-guard triggers) + reference data. Each test file then clones it.
 */
export default async function setup() {
  const base = testDatabaseUrl();
  const template = templateDatabaseName(base);
  const templateUrl = withDatabase(base, template);
  const admin = new PrismaClient({ datasourceUrl: adminUrl(base) });

  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${quoteIdent(template)} WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${quoteIdent(template)}`);
  } finally {
    await admin.$disconnect();
  }

  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: templateUrl, DIRECT_URL: templateUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({ datasourceUrl: templateUrl });
  try {
    // Low bcrypt cost keeps the suite fast; verification is cost-independent.
    await seedReferenceData(prisma, await bcrypt.hash(DEMO_PASSWORD, 4));
  } finally {
    await prisma.$disconnect();
  }

  return async () => {
    const cleanup = new PrismaClient({ datasourceUrl: adminUrl(base) });
    try {
      await cleanup.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${quoteIdent(template)} WITH (FORCE)`);
    } finally {
      await cleanup.$disconnect();
    }
  };
}
