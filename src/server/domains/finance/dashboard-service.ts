import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

import { db } from "@/server/db/client";

export type DashboardProjection = {
  month: string;
  raised: string;
  spent: string;
  balance: string;
  activeDonors: number;
  expiringLots: number;
  byProject: Array<{ projectId: string; projectName: string; raised: string; spent: string }>;
  recurringVsOneOff: { recurring: string; oneOff: string };
};

function toMoney(d: Decimal | null): string {
  return (d ?? new Decimal(0)).toFixed(2);
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  return { start, end };
}

function currentMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Active donor = has at least one CONFIRMED INCOME ledger entry in the month
async function countActiveDonors(start: Date, end: Date, client: PrismaClient): Promise<number> {
  const result = await client.ledgerEntry.findMany({
    where: {
      occurredOn: { gte: start, lt: end },
      type: "INCOME",
      status: "CONFIRMED",
      donorId: { not: null },
    },
    distinct: ["donorId"],
    select: { donorId: true },
  });
  return result.length;
}

type LedgerAggregate = {
  _sum: { amount: Decimal | null };
};

async function sumByType(
  type: "INCOME" | "EXPENSE",
  where: { start: Date; end: Date },
  client: PrismaClient,
): Promise<Decimal> {
  const agg: LedgerAggregate = await client.ledgerEntry.aggregate({
    where: {
      type,
      status: "CONFIRMED",
      occurredOn: { gte: where.start, lt: where.end },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Decimal(0);
}

export async function getDashboard(
  monthParam: string | undefined,
  client: PrismaClient = db,
): Promise<DashboardProjection> {
  const month = monthParam ?? currentMonth();
  const { start, end } = monthBounds(month);

  const [raised, spent, activeDonors] = await Promise.all([
    sumByType("INCOME", { start, end }, client),
    sumByType("EXPENSE", { start, end }, client),
    countActiveDonors(start, end, client),
  ]);

  const balance = raised.minus(spent);

  // By-project breakdown (INCOME only, confirmed)
  const projectEntries = await client.ledgerEntry.findMany({
    where: {
      status: "CONFIRMED",
      occurredOn: { gte: start, lt: end },
      destinationType: "PROJECT",
      projectId: { not: null },
    },
    include: { project: { select: { name: true } } },
  });

  const byProjectMap = new Map<string, { name: string; raised: Decimal; spent: Decimal }>();
  for (const entry of projectEntries) {
    if (!entry.projectId) continue;
    const key = entry.projectId;
    if (!byProjectMap.has(key)) {
      byProjectMap.set(key, { name: entry.project?.name ?? key, raised: new Decimal(0), spent: new Decimal(0) });
    }
    const bucket = byProjectMap.get(key)!;
    if (entry.type === "INCOME") bucket.raised = bucket.raised.plus(entry.amount);
    else bucket.spent = bucket.spent.plus(entry.amount);
  }

  const byProject = Array.from(byProjectMap.entries()).map(([projectId, v]) => ({
    projectId,
    projectName: v.name,
    raised: v.raised.toFixed(2),
    spent: v.spent.toFixed(2),
  }));

  // Recurring vs one-off
  const recurringEntries = await client.ledgerEntry.findMany({
    where: {
      type: "INCOME",
      status: "CONFIRMED",
      occurredOn: { gte: start, lt: end },
      donor: { relationshipType: "RECURRING" },
    },
    select: { amount: true },
  });
  const recurringTotal = recurringEntries.reduce(
    (acc, e) => acc.plus(e.amount),
    new Decimal(0),
  );
  const oneOffTotal = raised.minus(recurringTotal);

  const recurringVsOneOff = {
    recurring: recurringTotal.toFixed(2),
    oneOff: oneOffTotal.toFixed(2),
  };

  return {
    month,
    raised: toMoney(raised),
    spent: toMoney(spent),
    balance: toMoney(balance),
    activeDonors,
    expiringLots: 0,
    byProject,
    recurringVsOneOff,
  };
}
