import { fileURLToPath } from "node:url";
import { defineWorkspace } from "vitest/config";

/**
 * Two suites:
 *  - unit:        pure domain rules (no I/O) — run anywhere.
 *  - integration: Route Handlers + services against a real PostgreSQL
 *                 (TEST_DATABASE_URL). Each test file gets its own database
 *                 cloned from a migrated template, so files run in parallel
 *                 without sharing state.
 *
 * Paths are anchored to the repository root so the suites behave the same
 * whatever directory Vitest is started from.
 */
const root = fileURLToPath(new URL("..", import.meta.url));

const shared = {
  root,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
      // `server-only` throws outside the React Server Components bundler; tests run server code directly.
      "server-only": fileURLToPath(new URL("./setup/server-only-stub.ts", import.meta.url)),
    },
  },
};

export default defineWorkspace([
  {
    ...shared,
    test: {
      name: "unit",
      environment: "node",
      include: ["tests/unit/**/*.test.ts"],
    },
  },
  {
    ...shared,
    test: {
      name: "integration",
      environment: "node",
      include: ["tests/integration/**/*.test.ts"],
      globalSetup: ["tests/setup/global-db.ts"],
      setupFiles: ["tests/setup/integration.ts"],
      pool: "forks",
      testTimeout: 30_000,
      hookTimeout: 120_000,
    },
  },
]);
