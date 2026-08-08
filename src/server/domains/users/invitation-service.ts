import type { PrismaClient } from "@prisma/client";

import { createInvitationLink } from "@/server/auth/password-links";
import { db } from "@/server/db/client";
import { NotFoundError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

export async function resendInvitation(
  actorUserId: string,
  userId: string,
  appUrl: string,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("Usuário não encontrado");
    const invitation = await createInvitationLink(userId, appUrl, actorUserId, tx);
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "user.invitation.resend",
      entityType: "User", entityId: userId, outcome: "SUCCESS",
      metadata: {}, allowedMetadataKeys: [],
    }, tx);
    return { invitationUrl: invitation.url, expiresAt: invitation.expiresAt.toISOString(), deliveryStatus: "SIMULATED" as const };
  });
}
