import type { LedgerEntryStatus, LedgerEntryType, Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/server/db/client";

export type LedgerFilter = {
  from?: string;
  to?: string;
  projectId?: string;
  type?: LedgerEntryType;
  status?: LedgerEntryStatus;
};

export type PageParams = {
  page?: number;
  pageSize?: number;
};

export type LedgerPage = {
  items: SerializedLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SerializedLedgerEntry = {
  id: string;
  type: LedgerEntryType;
  amount: string;
  currency: string;
  occurredOn: string;
  donorId: string | null;
  donorName: string | null;
  destination: { type: "PROJECT" | "MOST_NEEDED"; projectId?: string };
  method: string;
  status: LedgerEntryStatus;
  origin: string;
};

export async function listLedgerEntries(
  filter: LedgerFilter,
  pagination: PageParams,
  client: PrismaClient = db,
): Promise<LedgerPage> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.LedgerEntryWhereInput = {};

  if (filter.from || filter.to) {
    where.occurredOn = {};
    if (filter.from) where.occurredOn.gte = new Date(filter.from);
    if (filter.to) where.occurredOn.lte = new Date(filter.to);
  }

  if (filter.projectId) where.projectId = filter.projectId;
  if (filter.type) where.type = filter.type;
  if (filter.status) where.status = filter.status;

  const [rows, total] = await Promise.all([
    client.ledgerEntry.findMany({
      where,
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: { donor: { select: { name: true } } },
    }),
    client.ledgerEntry.count({ where }),
  ]);

  return {
    items: rows.map(serializeLedgerEntry),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function serializeLedgerEntry(
  row: Prisma.LedgerEntryGetPayload<{ include: { donor: { select: { name: true } } } }>,
): SerializedLedgerEntry {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    occurredOn: row.occurredOn instanceof Date
      ? row.occurredOn.toISOString().slice(0, 10)
      : String(row.occurredOn),
    donorId: row.donorId,
    donorName: row.donor?.name ?? null,
    destination: row.destinationType === "PROJECT" && row.projectId
      ? { type: "PROJECT", projectId: row.projectId }
      : { type: "MOST_NEEDED" },
    method: row.method,
    status: row.status,
    origin: row.origin,
  };
}
