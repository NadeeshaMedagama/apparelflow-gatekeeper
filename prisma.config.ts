import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration. Because a config file is present, Prisma no longer
 * auto-loads `.env`; `dotenv/config` above does that explicitly.
 * Connection strings live in prisma/schema.prisma (DATABASE_URL / DIRECT_URL).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
});
