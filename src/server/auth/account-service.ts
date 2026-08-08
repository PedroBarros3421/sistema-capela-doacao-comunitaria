import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/server/auth/crypto";
import { revokeSession, revokeAllUserSessionsExcept } from "@/server/auth/auth-repository";
import { updateUserPasswordHash, updateUserProfile } from "@/server/domains/users/user-repository";
import { AuthenticationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";
import { db } from "@/server/db/client";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: "A nova senha deve conter letras e números",
  }),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
});

export async function logout(sessionId: string, client: PrismaClient = db) {
  await revokeSession(sessionId, client);
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  rawInput: unknown,
  client: PrismaClient = db,
) {
  const input = changePasswordSchema.parse(rawInput);

  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  const currentOk = user.passwordHash
    ? await verifyPassword(user.passwordHash, input.currentPassword)
    : false;

  if (!currentOk) {
    throw new AuthenticationError("Senha atual incorreta");
  }

  const newHash = await hashPassword(input.newPassword);
  await updateUserPasswordHash(userId, newHash, client);
  await revokeAllUserSessionsExcept(userId, currentSessionId, client);

  await appendAuditEvent(
    {
      actorKind: "USER",
      actorUserId: userId,
      action: "user.password_changed",
      entityType: "user",
      entityId: userId,
      outcome: "SUCCESS",
    },
    client,
  );
}

export async function updateProfile(
  userId: string,
  rawInput: unknown,
  client: PrismaClient = db,
) {
  const input = updateProfileSchema.parse(rawInput);
  if (!input.name) return client.user.findUniqueOrThrow({ where: { id: userId } });
  return updateUserProfile(userId, { name: input.name }, client);
}
