import { Prisma, type PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const discardSchema = z.object({
  type: z.literal("DISCARD").optional(),
  occurredOn: z.string().date(),
  reason: z.string().trim().min(1).max(1000),
  note: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({
    lotId: z.string().uuid(),
    quantity: z.string().regex(/^\d{1,11}(\.\d{1,3})?$/).refine((value) => Number(value) > 0),
  }).strict()).min(1),
}).strict();

type LockedLot = { id: string; available_quantity: Decimal; status: string; version: number };

export async function discardInventory(actorUserId: string, rawInput: unknown, client: PrismaClient = db) {
  const input = discardSchema.parse(rawInput);
  const ids = input.lines.map((line) => line.lotId);
  if (new Set(ids).size !== ids.length) throw new ValidationError("Cada lote deve aparecer apenas uma vez na movimentação");

  return client.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<LockedLot[]>(Prisma.sql`
      SELECT id, available_quantity, status, version
      FROM inventory_lots WHERE id IN (${Prisma.join(ids)})
      ORDER BY id FOR UPDATE
    `);
    if (locked.length !== ids.length) throw new NotFoundError("Um ou mais lotes não foram encontrados");
    const byId = new Map(locked.map((lot) => [lot.id, lot]));
    for (const line of input.lines) {
      const lot = byId.get(line.lotId)!;
      if (lot.status !== "AVAILABLE" || lot.available_quantity.lt(line.quantity)) {
        throw new ConflictError("O saldo de um lote mudou; revise o descarte");
      }
    }

    const movement = await tx.inventoryMovement.create({
      data: { type: "DISCARD", occurredOn: new Date(input.occurredOn), reason: input.reason, note: input.note, createdById: actorUserId },
    });
    for (const line of input.lines) {
      const lot = byId.get(line.lotId)!;
      const remaining = lot.available_quantity.sub(line.quantity);
      await tx.inventoryMovementLine.create({ data: { movementId: movement.id, lotId: lot.id, quantity: line.quantity, lotVersion: lot.version } });
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: { availableQuantity: remaining, status: remaining.isZero() ? "DISCARDED" : "AVAILABLE", version: { increment: 1 } },
      });
    }
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "inventory.discard.create",
      entityType: "InventoryMovement", entityId: movement.id, outcome: "SUCCESS",
      metadata: { reason: input.reason, lineCount: input.lines.length },
      allowedMetadataKeys: ["reason", "lineCount"],
    }, tx);
    return tx.inventoryMovement.findUniqueOrThrow({ where: { id: movement.id }, include: { lines: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
