import { PrismaClient } from "@prisma/client";

/** Drops the database created for this run (and only that one). */
export default async function globalTeardown() {
  const raw = process.env.E2E_RUN_DATABASE_URL;
  if (!raw) return;
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/^apparelflow_e2e_[a-z0-9_]+$/.test(database)) return;

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  } finally {
    await admin.$disconnect();
  }
}
