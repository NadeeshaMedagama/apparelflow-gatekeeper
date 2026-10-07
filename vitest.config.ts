import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest entry point. It stays at the repository root so the CLI and editor
 * integrations (WebStorm, VS Code) discover it; the unit and integration
 * suites themselves are defined next to the tests in tests/vitest.workspace.ts.
 * Paths are absolute so runs started from any directory resolve the same files.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    workspace: fileURLToPath(new URL("./tests/vitest.workspace.ts", import.meta.url)),
    reporters: ["default"],
  },
});
