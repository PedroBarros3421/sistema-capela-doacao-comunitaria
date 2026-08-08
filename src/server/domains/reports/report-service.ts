import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { ValidationError } from "@/server/http/errors";

export const reportPeriodSchema = z
  .object({ from: z.string().date(), to: z.string().date(), category: z.string().trim().max(80).optional() })
  .strict();

export type ReportPeriodInput = z.infer<typeof reportPeriodSchema>;

function toMoney(value: Decimal) {
  return value.toFixed(2);
}

function periodBounds(input: ReportPeriodInput) {
  const start = new Date(`${input.from}T00:00:00.000Z`);
  const end = new Date(`${input.to}T00:00:00.000Z`);
  if (start > end) throw new ValidationError("A data inicial não pode ser posterior à data final");
  const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, endExclusive };
}

export async function buildReportSnapshot(rawInput: unknown, client: PrismaClient = db) {
  const input = reportPeriodSchema.parse(rawInput);
  const { start, endExclusive } = periodBounds(input);

  const [incomeEntries, expenseEntries, lots, discardLines, activeItems] = await Promise.all([
    client.ledgerEntry.findMany({
      where: { type: "INCOME", status: "CONFIRMED", occurredOn: { gte: start, lt: endExclusive } },
      include: { project: { select: { id: true, name: true } } },
    }),
    client.ledgerEntry.findMany({
      where: { type: "EXPENSE", status: "CONFIRMED", occurredOn: { gte: start, lt: endExclusive } },
      include: { project: { select: { id: true, name: true } } },
    }),
    client.inventoryLot.findMany({
      where: {
        receivedOn: { gte: start, lt: endExclusive },
        ...(input.category ? { item: { category: input.category } } : {}),
      },
      include: { item: { select: { id: true, name: true, category: true, unit: true } } },
    }),
    client.inventoryMovementLine.findMany({
      where: {
        movement: { type: "DISCARD", occurredOn: { gte: start, lt: endExclusive } },
        ...(input.category ? { lot: { item: { category: input.category } } } : {}),
      },
      include: {
        lot: {
          select: {
            receivedQuantity: true,
            estimatedValue: true,
            item: { select: { id: true, name: true, category: true } },
          },
        },
      },
    }),
    client.inventoryItem.count({ where: { status: "ACTIVE" } }),
  ]);

  const totals = {
    moneyRaised: toMoney(incomeEntries.reduce((acc, e) => acc.plus(e.amount), new Decimal(0))),
    moneySpent: toMoney(expenseEntries.reduce((acc, e) => acc.plus(e.amount), new Decimal(0))),
    inKindReceived: toMoney(lots.reduce((acc, lot) => acc.plus(lot.estimatedValue), new Decimal(0))),
  };

  const byProjectMap = new Map<
    string,
    { projectId: string; projectName: string; moneyRaised: Decimal; moneySpent: Decimal }
  >();
  for (const entry of [...incomeEntries, ...expenseEntries]) {
    if (!entry.projectId || !entry.project) continue;
    if (!byProjectMap.has(entry.projectId)) {
      byProjectMap.set(entry.projectId, {
        projectId: entry.projectId,
        projectName: entry.project.name,
        moneyRaised: new Decimal(0),
        moneySpent: new Decimal(0),
      });
    }
    const bucket = byProjectMap.get(entry.projectId)!;
    if (entry.type === "INCOME") bucket.moneyRaised = bucket.moneyRaised.plus(entry.amount);
    else bucket.moneySpent = bucket.moneySpent.plus(entry.amount);
  }
  const byProject = Array.from(byProjectMap.values()).map((bucket) => ({
    projectId: bucket.projectId,
    projectName: bucket.projectName,
    moneyRaised: toMoney(bucket.moneyRaised),
    moneySpent: toMoney(bucket.moneySpent),
  }));

  const today = new Date(new Date().toISOString().slice(0, 10));
  const expiredQuantity = lots
    .filter((lot) => lot.expiresOn && lot.expiresOn < today && lot.status === "AVAILABLE")
    .reduce((acc, lot) => acc.plus(lot.availableQuantity), new Decimal(0));

  const discardedQuantity = discardLines.reduce((acc, line) => acc.plus(line.quantity), new Decimal(0));
  const discardedValue = discardLines.reduce((acc, line) => {
    const unitValue = line.lot.receivedQuantity.gt(0) ? line.lot.estimatedValue.div(line.lot.receivedQuantity) : new Decimal(0);
    return acc.plus(unitValue.mul(line.quantity));
  }, new Decimal(0));

  const receivedQuantityByItem = new Map<string, { name: string; category: string; received: Decimal }>();
  for (const lot of lots) {
    const key = lot.itemId;
    if (!receivedQuantityByItem.has(key)) {
      receivedQuantityByItem.set(key, { name: lot.item.name, category: lot.item.category, received: new Decimal(0) });
    }
    receivedQuantityByItem.get(key)!.received = receivedQuantityByItem.get(key)!.received.plus(lot.receivedQuantity);
  }
  const distributedByItem = new Map<string, Decimal>();
  for (const line of await client.inventoryMovementLine.findMany({
    where: { movement: { type: "DISTRIBUTION", occurredOn: { gte: start, lt: endExclusive } } },
    include: { lot: { select: { itemId: true } } },
  })) {
    distributedByItem.set(line.lot.itemId, (distributedByItem.get(line.lot.itemId) ?? new Decimal(0)).plus(line.quantity));
  }
  const turnoverByItem = Array.from(receivedQuantityByItem.entries()).map(([itemId, bucket]) => {
    const distributed = distributedByItem.get(itemId) ?? new Decimal(0);
    const turnoverRate = bucket.received.gt(0) ? distributed.div(bucket.received).toFixed(4) : "0.0000";
    return {
      itemId,
      itemName: bucket.name,
      category: bucket.category,
      receivedQuantity: bucket.received.toFixed(3),
      distributedQuantity: distributed.toFixed(3),
      turnoverRate,
    };
  });

  const inventory = {
    activeItemCount: activeItems,
    turnoverByItem,
    expiredQuantity: expiredQuantity.toFixed(3),
    discardedQuantity: discardedQuantity.toFixed(3),
    discardedValue: toMoney(discardedValue),
  };

  return { from: input.from, to: input.to, category: input.category ?? null, totals, byProject, inventory };
}

export type ReportSnapshot = Awaited<ReturnType<typeof buildReportSnapshot>>;
