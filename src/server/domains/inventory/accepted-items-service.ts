import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { NotFoundError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const acceptanceSchema = z.object({
  accepted: z.boolean().optional(),
  priority: z.boolean().optional(),
}).partial();

export async function updateItemAcceptance(
  actorUserId: string,
  itemId: string,
  rawInput: unknown,
  client: Prisma.TransactionClient = db,
) {
  const input = acceptanceSchema.parse(rawInput);
  if (input.accepted === undefined && input.priority === undefined) return;

  const item = await client.inventoryItem.findUnique({ where: { id: itemId }, include: { acceptedConfig: true } });
  if (!item) throw new NotFoundError("Item não encontrado");

  const accepted = input.accepted ?? item.acceptedConfig?.accepted ?? false;
  const priority = accepted ? (input.priority ?? item.acceptedConfig?.priority ?? false) : false;

  await client.acceptedItemConfig.upsert({
    where: { itemId },
    create: { itemId, accepted, priority, updatedById: actorUserId },
    update: { accepted, priority, updatedById: actorUserId },
  });

  await appendAuditEvent({
    actorUserId,
    actorKind: "USER",
    action: "inventory.accepted-item.update",
    entityType: "AcceptedItemConfig",
    entityId: itemId,
    outcome: "SUCCESS",
    metadata: { accepted, priority },
    allowedMetadataKeys: ["accepted", "priority"],
  }, client);
}

export async function listPublicAcceptedItems(client: PrismaClient = db) {
  const items = await client.inventoryItem.findMany({
    where: { status: "ACTIVE", acceptedConfig: { accepted: true } },
    include: { acceptedConfig: true },
  });
  return items
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      priority: item.acceptedConfig?.priority ?? false,
    }))
    .sort((left, right) => Number(right.priority) - Number(left.priority) || left.name.localeCompare(right.name, "pt-BR"));
}
