/**
 * Prepares the throw-away database for one end-to-end run (invoked by the
 * Playwright webServer command before the app starts).
 *
 * Safety: it only ever CREATEs a brand-new database whose name carries the
 * dedicated `apparelflow_e2e_` prefix, then applies migrations (non-destructive
 * `migrate deploy`) and seeds it. It never resets or drops existing data.
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL must point at the e2e database");

const url = new URL(raw);
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!/^apparelflow_e2e_[a-z0-9_]+$/.test(database)) {
  throw new Error(`Refusing to prepare "${database}": e2e databases must be named apparelflow_e2e_<run-id>.`);
}

const adminUrl = new URL(url.toString());
adminUrl.pathname = "/postgres";

const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
try {
  // Fails if the database already exists — existing data is never touched.
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
} finally {
  await admin.$disconnect();
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const env = { ...process.env, DIRECT_URL: raw, PRISMA_HIDE_UPDATE_MESSAGE: "1" };
execFileSync(npx, ["prisma", "migrate", "deploy"], { env, stdio: "inherit" });
execFileSync(npx, ["prisma", "db", "seed"], { env, stdio: "inherit" });
console.log(`[e2e] Database ${database} ready.`);
