import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { appendAuditEvent } from "@/server/observability/audit";
import { serializeLedgerEntry } from "./ledger-repository";

const manualLedgerSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform((v) => v),
  occurredOn: z.string().date(),
  donorId: z.string().uuid().optional(),
  destination: z.discriminatedUnion("type", [
    z.object({ type: z.literal("PROJECT"), projectId: z.string().uuid() }),
    z.object({ type: z.literal("MOST_NEEDED") }),
  ]),
  method: z.enum(["PIX", "CARD", "CASH", "BOLETO"]),
  status: z.enum(["PENDING", "CONFIRMED"]),
}).strict();

export type ManualLedgerInput = z.infer<typeof manualLedgerSchema>;

export async function createManualLedgerEntry(
  actorUserId: string,
  rawInput: unknown,
  client: PrismaClient = db,
) {
  const input = manualLedgerSchema.parse(rawInput);

  const entry = await client.ledgerEntry.create({
    data: {
      type: input.type,
      amount: input.amount,
      currency: "BRL",
      occurredOn: new Date(input.occurredOn),
      donorId: input.donorId ?? null,
      destinationType: input.destination.type,
      projectId: input.destination.type === "PROJECT" ? input.destination.projectId : null,
      method: input.method,
      status: input.status,
      origin: "ADMIN",
      createdById: actorUserId,
      confirmedAt: input.status === "CONFIRMED" ? new Date() : null,
    },
    include: { donor: { select: { name: true } } },
  });

  await appendAuditEvent({
    actorUserId,
    actorKind: "USER",
    action: "ledger.manual_entry.create",
    entityType: "LedgerEntry",
    entityId: entry.id,
    outcome: "SUCCESS",
    metadata: { type: input.type, amount: input.amount, origin: "ADMIN" },
    allowedMetadataKeys: ["type", "amount", "origin"],
  }, client);

  return serializeLedgerEntry(entry);
}
