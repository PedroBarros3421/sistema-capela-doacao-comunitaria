import type { Prisma } from "@prisma/client";

import { db } from "@/server/db/client";
import { hashSecret } from "@/server/auth/crypto";

type AuthClient = Pick<Prisma.TransactionClient, "session" | "loginAttempt" | "accessLink">;

export async function createSession(
  userId: string,
  token: string,
  expiresAt: Date,
  context: { ip?: string; userAgent?: string } = {},
  client: AuthClient = db,
) {
  return client.session.create({
    data: {
      userId,
      tokenHash: hashSecret(token),
      expiresAt,
      ip: context.ip,
      userAgent: context.userAgent,
    },
  });
}

export async function revokeSession(sessionId: string, client: AuthClient = db) {
  return client.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessionsExcept(
  userId: string,
  exceptSessionId: string,
  client: AuthClient = db,
) {
  return client.session.updateMany({
    where: { userId, id: { not: exceptSessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string, client: AuthClient = db) {
  return client.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function recordLoginAttempt(
  data: {
    userId?: string;
    attemptedEmail: string;
    result: "SUCCESS" | "INVALID_CREDENTIALS" | "PENDING" | "INACTIVE" | "BLOCKED";
    ip?: string;
    userAgent?: string;
  },
  client: AuthClient = db,
) {
  return client.loginAttempt.create({ data });
}

export async function findValidAccessLink(
  token: string,
  purpose: "INVITE" | "PASSWORD_RESET",
  client: AuthClient = db,
) {
  const now = new Date();
  return client.accessLink.findFirst({
    where: {
      tokenHash: hashSecret(token),
      purpose,
      expiresAt: { gt: now },
      revokedAt: null,
    },
    include: { user: true },
  });
}

export async function revokeUserAccessLinksByPurpose(
  userId: string,
  purpose: "INVITE" | "PASSWORD_RESET",
  client: AuthClient = db,
) {
  return client.accessLink.updateMany({
    where: { userId, purpose, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createAccessLink(
  data: {
    purpose: "INVITE" | "PASSWORD_RESET";
    tokenHash: string;
    userId: string;
    createdById?: string;
    expiresAt: Date;
  },
  client: AuthClient = db,
) {
  return client.accessLink.create({ data });
}
