import type { InventoryLot, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import { calculateLotValuation } from "./valuation-service";

const quantitySchema = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/).refine((value) => Number(value) > 0);
const moneySchema = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  unit: z.enum(["KG", "UNIT", "LITER"]),
  averageUnitValue: moneySchema,
}).strict();

const itemUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  unit: z.enum(["KG", "UNIT", "LITER"]).optional(),
  averageUnitValue: moneySchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).partial();

const lotSchema = z.object({
  itemId: z.string().uuid(),
  quantity: quantitySchema,
  receivedOn: z.string().date(),
  expiresOn: z.string().date().nullable().optional(),
  donorId: z.string().uuid().optional(),
  donorName: z.string().trim().min(1).max(160).optional(),
  estimatedValue: moneySchema.optional(),
  valuationSource: z.enum(["MANUAL", "AVERAGE_AT_RECEIPT"]).optional(),
  acceptExpiredDate: z.boolean().optional(),
}).strict();

export type InventoryLotFilter = {
  itemId?: string;
  expiryWindowDays?: 7 | 30;
  includeLots?: boolean;
  page?: number;
  pageSize?: number;
};

export function serializeInventoryLot(lot: InventoryLot) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysToExpiry = lot.expiresOn
    ? Math.ceil((lot.expiresOn.getTime() - today.getTime()) / 86_400_000)
    : null;
  const alertLevel = daysToExpiry === null || daysToExpiry > 30
    ? "NONE"
    : daysToExpiry <= 7 ? "URGENT" : "ATTENTION";

  return {
    id: lot.id,
    itemId: lot.itemId,
    quantity: lot.receivedQuantity.toFixed(3),
    availableQuantity: lot.availableQuantity.toFixed(3),
    receivedOn: lot.receivedOn.toISOString().slice(0, 10),
    expiresOn: lot.expiresOn?.toISOString().slice(0, 10) ?? null,
    donorId: lot.donorId,
    donorName: lot.donorNameSnapshot,
    estimatedValue: lot.estimatedValue.toFixed(2),
    valuationSource: lot.valuationSource,
    unitValueSnapshot: lot.unitValueSnapshot?.toFixed(2) ?? null,
    status: lot.status,
    version: lot.version,
    alertLevel,
  };
}

export async function listInventoryItems(client: PrismaClient = db) {
  const items = await client.inventoryItem.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { acceptedConfig: true },
  });
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    averageUnitValue: item.averageUnitValue.toFixed(2),
    status: item.status,
    accepted: item.acceptedConfig?.accepted ?? false,
    priority: item.acceptedConfig?.priority ?? false,
  }));
}

export async function createInventoryItem(actorUserId: string, rawInput: unknown, client: PrismaClient = db) {
  const input = itemSchema.parse(rawInput);
  const item = await client.inventoryItem.create({
    data: {
      name: input.name,
      category: input.category,
      unit: input.unit,
      averageUnitValue: input.averageUnitValue,
      acceptedConfig: { create: { accepted: true, priority: false, updatedById: actorUserId } },
    },
    include: { acceptedConfig: true },
  });
  return {
    id: item.id, name: item.name, category: item.category, unit: item.unit,
    averageUnitValue: item.averageUnitValue.toFixed(2), status: item.status,
    accepted: item.acceptedConfig?.accepted ?? false, priority: item.acceptedConfig?.priority ?? false,
  };
}

function serializeInventoryItem(item: Prisma.InventoryItemGetPayload<{ include: { acceptedConfig: true } }>) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    averageUnitValue: item.averageUnitValue.toFixed(2),
    status: item.status,
    accepted: item.acceptedConfig?.accepted ?? false,
    priority: item.acceptedConfig?.priority ?? false,
  };
}

export async function getInventoryItem(itemId: string, client: Prisma.TransactionClient = db) {
  const item = await client.inventoryItem.findUnique({ where: { id: itemId }, include: { acceptedConfig: true } });
  if (!item) throw new NotFoundError("Item não encontrado");
  return serializeInventoryItem(item);
}

export async function updateInventoryCatalog(itemId: string, rawInput: unknown, client: Prisma.TransactionClient = db) {
  const input = itemUpdateSchema.parse(rawInput);
  if (Object.values(input).every((value) => value === undefined)) return;
  const existing = await client.inventoryItem.findUnique({ where: { id: itemId } });
  if (!existing) throw new NotFoundError("Item não encontrado");
  await client.inventoryItem.update({
    where: { id: itemId },
    data: {
      name: input.name,
      category: input.category,
      unit: input.unit,
      averageUnitValue: input.averageUnitValue,
      status: input.status,
    },
  });
}

export async function createInventoryLot(actorUserId: string, rawInput: unknown, client: PrismaClient = db) {
  const input = lotSchema.parse(rawInput);
  const item = await client.inventoryItem.findUnique({ where: { id: input.itemId } });
  if (!item || item.status !== "ACTIVE") throw new NotFoundError("Item ativo não encontrado");

  const receivedOn = new Date(`${input.receivedOn}T00:00:00.000Z`);
  const expiresOn = input.expiresOn ? new Date(`${input.expiresOn}T00:00:00.000Z`) : null;
  if (expiresOn && expiresOn < receivedOn && !input.acceptExpiredDate) {
    throw new ValidationError("A validade anterior ao recebimento exige confirmação explícita");
  }

  const valuation = calculateLotValuation({
    quantity: input.quantity,
    averageUnitValue: item.averageUnitValue,
    valuationSource: input.valuationSource,
    estimatedValue: input.estimatedValue,
  });
  const lot = await client.inventoryLot.create({
    data: {
      itemId: input.itemId,
      receivedQuantity: input.quantity,
      availableQuantity: input.quantity,
      receivedOn,
      expiresOn,
      donorId: input.donorId,
      donorNameSnapshot: input.donorName,
      estimatedValue: valuation.estimatedValue,
      valuationSource: valuation.valuationSource,
      unitValueSnapshot: valuation.unitValueSnapshot,
      createdById: actorUserId,
    },
  });
  return serializeInventoryLot(lot);
}

export async function listConsolidatedInventory(filter: InventoryLotFilter, client: PrismaClient = db) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const lotWhere: Prisma.InventoryLotWhereInput = {};
  if (filter.expiryWindowDays) {
    const until = new Date();
    until.setUTCHours(23, 59, 59, 999);
    until.setUTCDate(until.getUTCDate() + filter.expiryWindowDays);
    lotWhere.expiresOn = { lte: until };
    lotWhere.status = "AVAILABLE";
  }
  const where: Prisma.InventoryItemWhereInput = {
    ...(filter.itemId ? { id: filter.itemId } : {}),
    ...(filter.expiryWindowDays ? { lots: { some: lotWhere } } : {}),
  };
  const [items, total] = await Promise.all([
    client.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        lots: {
          where: lotWhere,
          orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }, { receivedOn: "asc" }, { id: "asc" }],
        },
      },
    }),
    client.inventoryItem.count({ where }),
  ]);
  return {
    items: items.map((item) => ({
      item: { id: item.id, name: item.name, category: item.category, unit: item.unit },
      availableQuantity: item.lots.reduce((sum, lot) => sum + Number(lot.availableQuantity), 0).toFixed(3),
      lotCount: item.lots.length,
      ...(filter.includeLots ? { lots: item.lots.map(serializeInventoryLot) } : {}),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
