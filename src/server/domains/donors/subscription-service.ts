import type { PrismaClient, RecurringSubscription } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { ConflictError, NotFoundError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CHANGE_AMOUNT"), amount: z.string().regex(/^\d+(\.\d{1,2})?$/) }).strict(),
  z.object({ action: z.enum(["PAUSE", "RESUME", "CANCEL"]) }).strict(),
]);

export function serializeSubscription(subscription: RecurringSubscription) {
  return {
    id: subscription.id,
    amount: subscription.amount.toFixed(2),
    currency: subscription.currency,
    status: subscription.status,
    method: subscription.method,
    nextChargeDate: subscription.nextChargeDate?.toISOString().slice(0, 10) ?? null,
    destination: subscription.destinationType === "PROJECT" && subscription.projectId
      ? { type: "PROJECT" as const, projectId: subscription.projectId }
      : { type: "MOST_NEEDED" as const },
  };
}

export async function updateOwnedSubscription(
  donorId: string,
  subscriptionId: string,
  rawInput: unknown,
  client: PrismaClient = db,
) {
  const input = updateSchema.parse(rawInput);

  const subscription = await client.recurringSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.donorId !== donorId) throw new NotFoundError("Recorrência não encontrada");
  if (subscription.status === "CANCELLED") throw new ConflictError("A recorrência já está cancelada");

  const data = (() => {
    switch (input.action) {
      case "CHANGE_AMOUNT":
        return { amount: input.amount };
      case "PAUSE":
        if (subscription.status !== "ACTIVE") throw new ConflictError("Apenas recorrências ativas podem ser pausadas");
        return { status: "PAUSED" as const };
      case "RESUME":
        if (subscription.status !== "PAUSED") throw new ConflictError("Apenas recorrências pausadas podem ser retomadas");
        return { status: "ACTIVE" as const };
      case "CANCEL":
        return { status: "CANCELLED" as const, nextChargeDate: null };
    }
  })();

  const updated = await client.recurringSubscription.update({
    where: { id: subscriptionId },
    data,
  });

  await appendAuditEvent(
    {
      actorKind: "DONOR_LINK",
      action: `donor.subscription.${input.action.toLowerCase()}`,
      entityType: "RecurringSubscription",
      entityId: subscriptionId,
      outcome: "SUCCESS",
      metadata: { action: input.action },
      allowedMetadataKeys: ["action"],
    },
    client,
  );

  return serializeSubscription(updated);
}
