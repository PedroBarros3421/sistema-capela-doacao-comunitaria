import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { generateOpaqueToken, hashPassword, hashSecret } from "@/server/auth/crypto";
import {
  createAccessLink,
  findValidAccessLink,
  revokeUserAccessLinksByPurpose,
} from "@/server/auth/auth-repository";
import { findUserByEmail, updateUserPasswordHash } from "@/server/domains/users/user-repository";
import { AuthenticationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";
import { simulateNotification } from "@/server/integrations/notification-simulator";
import { db } from "@/server/db/client";

const LINK_TTL_DAYS = 30;

const newPasswordSchema = z.object({
  newPassword: z.string().min(8).regex(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: "A senha deve conter letras e números",
  }),
});

function linkExpiresAt() {
  return new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createInvitationLink(
  userId: string,
  appUrl: string,
  createdById: string | undefined,
  client: PrismaClient | Prisma.TransactionClient = db,
) {
  await revokeUserAccessLinksByPurpose(userId, "INVITE", client);
  const token = generateOpaqueToken();
  const expiresAt = linkExpiresAt();
  await createAccessLink(
    { purpose: "INVITE", tokenHash: hashSecret(token), userId, createdById, expiresAt },
    client,
  );
  const url = new URL("/acesso/convite", appUrl);
  url.searchParams.set("token", token);
  return { url: url.toString(), expiresAt };
}

export async function setPasswordFromInvitation(
  token: string,
  rawInput: unknown,
  client: PrismaClient = db,
) {
  const input = newPasswordSchema.parse(rawInput);
  const link = await findValidAccessLink(token, "INVITE", client);
  if (!link || !link.user) throw new AuthenticationError("Link de convite inválido ou expirado");

  const newHash = await hashPassword(input.newPassword);
  await updateUserPasswordHash(link.user.id, newHash, client);

  if (link.user.status === "PENDING") {
    await client.user.update({ where: { id: link.user.id }, data: { status: "ACTIVE" } });
  }

  await appendAuditEvent(
    {
      actorKind: "USER",
      actorUserId: link.user.id,
      action: "user.password_set_via_invite",
      entityType: "user",
      entityId: link.user.id,
      outcome: "SUCCESS",
    },
    client,
  );
}

export async function requestPasswordReset(
  rawInput: unknown,
  appUrl: string,
  client: PrismaClient = db,
) {
  const { email } = z.object({ email: z.email() }).parse(rawInput);
  const normalizedEmail = email.trim().toLowerCase();

  const user = await findUserByEmail(normalizedEmail, client);
  if (user && user.status === "ACTIVE") {
    await revokeUserAccessLinksByPurpose(user.id, "PASSWORD_RESET", client);
    const token = generateOpaqueToken();
    const expiresAt = linkExpiresAt();
    await createAccessLink(
      { purpose: "PASSWORD_RESET", tokenHash: hashSecret(token), userId: user.id, expiresAt },
      client,
    );
    const resetUrl = new URL("/acesso/redefinir", appUrl);
    resetUrl.searchParams.set("token", token);
    simulateNotification({
      type: "PASSWORD_RESET",
      to: user.email,
      payload: { resetUrl: resetUrl.toString(), userName: user.name },
    });
  }

  return {
    message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve.",
    deliveryStatus: "SIMULATED" as const,
  };
}

export async function setPasswordFromReset(
  token: string,
  rawInput: unknown,
  client: PrismaClient = db,
) {
  const input = newPasswordSchema.parse(rawInput);
  const link = await findValidAccessLink(token, "PASSWORD_RESET", client);
  if (!link || !link.user) throw new AuthenticationError("Link de redefinição inválido ou expirado");

  const newHash = await hashPassword(input.newPassword);
  await updateUserPasswordHash(link.user.id, newHash, client);

  await appendAuditEvent(
    {
      actorKind: "USER",
      actorUserId: link.user.id,
      action: "user.password_reset",
      entityType: "user",
      entityId: link.user.id,
      outcome: "SUCCESS",
    },
    client,
  );
}
