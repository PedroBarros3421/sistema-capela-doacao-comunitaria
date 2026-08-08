import { Prisma, type PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const quantitySchema = z.string().regex(/^\d{1,11}(\.\d{1,3})?$/).refine((value) => Number(value) > 0);
const suggestionSchema = z.object({ itemId: z.string().uuid(), quantity: quantitySchema }).strict();
const distributionSchema = z.object({
  type: z.literal("DISTRIBUTION").optional(),
  occurredOn: z.string().date(),
  projectId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({ lotId: z.string().uuid(), quantity: quantitySchema }).strict()).min(1),
}).strict();

function sortedAllocation(lines: Array<{ lotId: string; quantity: string }>) {
  return lines
    .map((line) => ({ lotId: line.lotId, quantity: new Decimal(line.quantity).toFixed(3) }))
    .sort((a, b) => a.lotId.localeCompare(b.lotId));
}

type LockedLot = {
  id: string;
  item_id: string;
  available_quantity: Decimal;
  received_on: Date;
  expires_on: Date | null;
  status: "AVAILABLE" | "EXHAUSTED" | "DISCARDED";
  version: number;
};

function ensureUniqueLots(lines: Array<{ lotId: string }>) {
  if (new Set(lines.map((line) => line.lotId)).size !== lines.length) {
    throw new ValidationError("Cada lote deve aparecer apenas uma vez na movimentação");
  }
}

export async function suggestDistribution(rawInput: unknown, client: PrismaClient | Prisma.TransactionClient = db) {
  const input = suggestionSchema.parse(rawInput);
  const lots = await client.inventoryLot.findMany({
    where: {
      itemId: input.itemId,
      status: "AVAILABLE",
      availableQuantity: { gt: 0 },
      OR: [{ expiresOn: null }, { expiresOn: { gte: new Date(new Date().toISOString().slice(0, 10)) } }],
    },
    orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }, { receivedOn: "asc" }, { id: "asc" }],
  });
  let remaining = new Decimal(input.quantity);
  const lines: Array<{ lotId: string; quantity: string; lotVersion: number }> = [];
  for (const lot of lots) {
    if (remaining.lte(0)) break;
    const quantity = Decimal.min(remaining, lot.availableQuantity);
    lines.push({ lotId: lot.id, quantity: quantity.toFixed(3), lotVersion: lot.version });
    remaining = remaining.sub(quantity);
  }
  if (remaining.gt(0)) throw new ConflictError("Estoque disponível insuficiente para a quantidade solicitada");
  return lines;
}

export async function distributeInventory(actorUserId: string, rawInput: unknown, client: PrismaClient = db) {
  const input = distributionSchema.parse(rawInput);
  ensureUniqueLots(input.lines);
  return client.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: input.projectId } });
    if (!project || project.status !== "ACTIVE") throw new NotFoundError("Projeto ativo não encontrado");

    const ids = input.lines.map((line) => line.lotId);
    const locked = await tx.$queryRaw<LockedLot[]>(Prisma.sql`
      SELECT id, item_id, available_quantity, received_on, expires_on, status, version
      FROM inventory_lots
      WHERE id IN (${Prisma.join(ids)})
      ORDER BY expires_on ASC NULLS LAST, received_on ASC, id ASC
      FOR UPDATE
    `);
    if (locked.length !== ids.length) throw new NotFoundError("Um ou mais lotes não foram encontrados");

    const byId = new Map(locked.map((lot) => [lot.id, lot]));
    const today = new Date(new Date().toISOString().slice(0, 10));
    for (const line of input.lines) {
      const lot = byId.get(line.lotId)!;
      const quantity = new Decimal(line.quantity);
      if (lot.status !== "AVAILABLE" || lot.available_quantity.lt(quantity)) {
        throw new ConflictError("O saldo de um lote mudou; revise a distribuição");
      }
      if (lot.expires_on && lot.expires_on < today) {
        throw new ConflictError("Lotes vencidos não são elegíveis para distribuição");
      }
    }

    const requestedByItem = new Map<string, Decimal>();
    for (const line of input.lines) {
      const lot = byId.get(line.lotId)!;
      requestedByItem.set(lot.item_id, (requestedByItem.get(lot.item_id) ?? new Decimal(0)).add(line.quantity));
    }

    let diverges = false;
    const suggestionSnapshot: Record<string, Array<{ lotId: string; quantity: string }>> = {};
    for (const [itemId, quantity] of requestedByItem) {
      const suggested = await suggestDistribution({ itemId, quantity: quantity.toFixed(3) }, tx);
      suggestionSnapshot[itemId] = suggested.map((line) => ({ lotId: line.lotId, quantity: line.quantity }));
      const confirmedForItem = input.lines.filter((line) => byId.get(line.lotId)!.item_id === itemId);
      if (JSON.stringify(sortedAllocation(confirmedForItem)) !== JSON.stringify(sortedAllocation(suggested))) {
        diverges = true;
      }
    }
    if (diverges && !input.reason) {
      throw new ValidationError("Informe o motivo do ajuste manual da distribuição sugerida");
    }

    const movement = await tx.inventoryMovement.create({
      data: {
        type: "DISTRIBUTION",
        occurredOn: new Date(input.occurredOn),
        projectId: input.projectId,
        reason: input.reason,
        note: input.note,
        createdById: actorUserId,
      },
    });
    for (const line of input.lines) {
      const lot = byId.get(line.lotId)!;
      const remaining = lot.available_quantity.sub(line.quantity);
      await tx.inventoryMovementLine.create({
        data: { movementId: movement.id, lotId: lot.id, quantity: line.quantity, lotVersion: lot.version },
      });
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: { availableQuantity: remaining, status: remaining.isZero() ? "EXHAUSTED" : "AVAILABLE", version: { increment: 1 } },
      });
    }
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "inventory.distribution.create",
      entityType: "InventoryMovement", entityId: movement.id, outcome: "SUCCESS",
      metadata: {
        projectId: input.projectId,
        lineCount: input.lines.length,
        manualAdjustment: diverges,
        ...(diverges ? { reason: input.reason, suggestionSnapshot: JSON.stringify(suggestionSnapshot) } : {}),
      },
      allowedMetadataKeys: ["projectId", "lineCount", "manualAdjustment", "reason", "suggestionSnapshot"],
    }, tx);
    return tx.inventoryMovement.findUniqueOrThrow({ where: { id: movement.id }, include: { lines: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
