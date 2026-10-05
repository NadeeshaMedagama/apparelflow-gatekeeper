import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// Load the project's .env by absolute path so CLI and IDE runners behave the same.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

/** Resolves the PostgreSQL connection used by the integration suite. */
export function testDatabaseUrl(): URL {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) {
    throw new Error(
      [
        "TEST_DATABASE_URL is not set.",
        "Integration tests need a PostgreSQL server where the role may CREATE/DROP databases, e.g.",
        '  TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/apparelflow_test"',
        "Use a local PostgreSQL (see docs/local-development.md) or start one with:  npm run docker:db",
      ].join("\n"),
    );
  }
  return new URL(raw);
}

export function withDatabase(base: URL, database: string): string {
  const url = new URL(base.toString());
  url.pathname = `/${database}`;
  return url.toString();
}

export function baseDatabaseName(base: URL): string {
  return decodeURIComponent(base.pathname.replace(/^\//, "")) || "apparelflow_test";
}

export function templateDatabaseName(base: URL): string {
  return `${baseDatabaseName(base)}_template`;
}

/** Connection to the server's maintenance database for CREATE/DROP DATABASE. */
export function adminUrl(base: URL): string {
  return withDatabase(base, "postgres");
}

export function quoteIdent(name: string): string {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Unsafe database name: ${name}`);
  return `"${name}"`;
}
