import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { getServerEnv } from "@/server/config/env";

const globalDatabase = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const env = getServerEnv();
  const adapter = new PrismaPg(env.DATABASE_URL);
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalDatabase.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalDatabase.prisma = db;
}
