import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Client generation does not need a live database. Migration commands still fail safely
    // unless DATABASE_URL points to a reachable PostgreSQL instance.
    url: process.env.DATABASE_URL ?? "postgresql://invalid:invalid@127.0.0.1:1/invalid",
  },
});
