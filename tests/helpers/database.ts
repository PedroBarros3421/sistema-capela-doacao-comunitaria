import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Client, Pool } from "pg";

export type DisposableDatabase = {
  client: PrismaClient;
  schema: string;
  cleanup: () => Promise<void>;
};

function databaseUrl(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Disposable databases cannot run in production");
  }
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for database tests");
  if (!url.startsWith("postgresql://")) throw new Error("Database tests require PostgreSQL");
  return url;
}

function quotedIdentifier(value: string): string {
  if (!/^test_[a-f0-9]+$/.test(value)) throw new Error("Unsafe test schema name");
  return `"${value}"`;
}

export async function createDisposableDatabase(): Promise<DisposableDatabase> {
  const connectionString = databaseUrl();
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  const identifier = quotedIdentifier(schema);
  const setupClient = new Client({ connectionString });

  await setupClient.connect();
  try {
    await setupClient.query(`CREATE SCHEMA ${identifier}`);
    await setupClient.query(`SET search_path TO ${identifier}`);
    const migration = await readFile(
      resolve(process.cwd(), "prisma/migrations/001_foundation/migration.sql"),
      "utf8",
    );
    await setupClient.query(migration);
  } catch (error) {
    await setupClient.query(`DROP SCHEMA IF EXISTS ${identifier} CASCADE`);
    throw error;
  } finally {
    await setupClient.end();
  }

  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  const client = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });

  return {
    client,
    schema,
    cleanup: async () => {
      await client.$disconnect();
      const cleanupClient = new Client({ connectionString });
      await cleanupClient.connect();
      try {
        await cleanupClient.query(`DROP SCHEMA ${identifier} CASCADE`);
      } finally {
        await cleanupClient.end();
      }
    },
  };
}
