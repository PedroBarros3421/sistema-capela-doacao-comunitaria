import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const globalDatabase = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = z.string().url().startsWith("postgresql://").parse(process.env.DATABASE_URL);
  const adapter = new PrismaPg(databaseUrl);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  const client = globalDatabase.prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalDatabase.prisma = client;
  return client;
}

// Delay environment validation and connection creation until a handler actually uses the
// database. Route modules can then load normally and map configuration errors to JSON responses.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
