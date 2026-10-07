import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

/**
 * End-to-end suite: the evaluator's 5-minute audit, driven through a real
 * browser against a production build (`next build && next start`).
 *
 * Every run creates its own brand-new database (apparelflow_e2e_<run-id>) on
 * the TEST_DATABASE_URL server, migrates and seeds it, and drops it afterwards.
 * Existing databases are never reset or modified.
 *
 * Run with `npm run test:e2e` (this file lives next to the specs it configures;
 * reports are written to the repository root).
 */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
loadEnv({ path: path.join(ROOT, ".env"), quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3200);

// Stable for the whole run (workers inherit the parent's environment).
process.env.E2E_RUN_ID ??= `${Date.now().toString(36)}_${process.pid}`;

function runDatabaseUrl(): string {
  const base = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/apparelflow_test");
  base.pathname = `/apparelflow_e2e_${process.env.E2E_RUN_ID}`;
  return base.toString();
}

const databaseUrl = runDatabaseUrl();
process.env.E2E_RUN_DATABASE_URL = databaseUrl;

const serverEnv: Record<string, string> = {
  ...(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)) as Record<string, string>),
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-0123456789abcdefghijklmnopqrstuv",
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
};

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: path.join(ROOT, "test-results"),
  globalTeardown: "./global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: path.join(ROOT, "playwright-report") }]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx tsx tests/e2e/prepare-database.ts && npm run build && npx next start -p ${PORT}`,
    cwd: ROOT,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 420_000,
    reuseExistingServer: false,
    env: serverEnv,
    stdout: "ignore",
    stderr: "pipe",
  },
});
