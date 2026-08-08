import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client, Pool } from "pg";

export type DisposableDatabase = {
  client: PrismaClient;
  connectionString: string;
  container: StartedPostgreSqlContainer;
  cleanup: () => Promise<void>;
};

function assertSafeTestEnvironment(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Disposable databases cannot run in production");
  }
}

export async function createDisposableDatabase(): Promise<DisposableDatabase> {
  assertSafeTestEnvironment();
  const container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("capela_test")
    .withUsername("capela_test")
    .withPassword("capela_test_password")
    .start();
  const connectionString = container.getConnectionUri().replace(/^postgres:\/\//, "postgresql://");
  const setupClient = new Client({ connectionString });

  await setupClient.connect();
  try {
    const migrationPaths = [
      "prisma/migrations/001_foundation/migration.sql",
      "prisma/migrations/002_public_donations/migration.sql",
      "prisma/migrations/003_inventory/migration.sql",
      "prisma/migrations/20260808114222_verify_inventory_migrations/migration.sql",
    ];
    for (const migrationPath of migrationPaths) {
      const migration = await readFile(resolve(process.cwd(), migrationPath), "utf8");
      await setupClient.query(migration);
    }
  } catch (error) {
    await container.stop();
    throw error;
  } finally {
    await setupClient.end();
  }

  const pool = new Pool({ connectionString });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  return {
    client,
    connectionString,
    container,
    cleanup: async () => {
      await client.$disconnect();
      await pool.end();
      await container.stop();
    },
  };
}
