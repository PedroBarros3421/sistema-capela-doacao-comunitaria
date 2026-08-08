import type { PrismaClient } from "@prisma/client";

import { db } from "@/server/db/client";

export type LoginHistoryFilter = { userId?: string; from?: string; to?: string; page?: number; pageSize?: number };

function serializeAttempt(attempt: {
  id: string;
  attemptedEmail: string;
  occurredAt: Date;
  ip: string | null;
  userAgent: string | null;
  result: string;
}) {
  return {
    id: attempt.id,
    attemptedEmail: attempt.attemptedEmail,
    occurredAt: attempt.occurredAt.toISOString(),
    ip: attempt.ip,
    device: attempt.userAgent,
    result: attempt.result,
  };
}

export async function listLoginAttempts(filter: LoginHistoryFilter, client: PrismaClient = db) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const where = {
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.from || filter.to
      ? { occurredAt: { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to) } : {}) } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    client.loginAttempt.findMany({ where, orderBy: [{ occurredAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    client.loginAttempt.count({ where }),
  ]);
  return { items: rows.map(serializeAttempt), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
