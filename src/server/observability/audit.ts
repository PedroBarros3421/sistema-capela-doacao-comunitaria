import type { AuditActorKind, AuditOutcome, Prisma } from "@prisma/client";

import { db } from "@/server/db/client";

type AuditClient = Pick<Prisma.TransactionClient, "auditEvent">;
type AuditMetadataValue = string | number | boolean | null;

export type AuditEventInput = {
  actorKind: AuditActorKind;
  actorUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  allowedMetadataKeys?: readonly string[];
};

function allowlistedMetadata(
  metadata: Record<string, unknown> = {},
  allowedKeys: readonly string[] = [],
): Record<string, AuditMetadataValue> {
  const result: Record<string, AuditMetadataValue> = {};
  for (const key of allowedKeys) {
    const value = metadata[key];
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      result[key] = value as AuditMetadataValue;
    }
  }
  return result;
}

export async function appendAuditEvent(
  input: AuditEventInput,
  client: AuditClient = db,
) {
  if ((input.entityType === undefined) !== (input.entityId === undefined)) {
    throw new Error("Audit entity type and id must be provided together");
  }
  if (input.actorKind === "USER" && !input.actorUserId) {
    throw new Error("User audit events require an actor id");
  }
  if (input.actorKind !== "USER" && input.actorUserId) {
    throw new Error("Only user audit events may contain an actor id");
  }

  return client.auditEvent.create({
    data: {
      actorKind: input.actorKind,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      outcome: input.outcome,
      metadata: allowlistedMetadata(input.metadata, input.allowedMetadataKeys),
    },
  });
}
