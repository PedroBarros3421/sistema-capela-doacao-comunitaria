import type { Prisma, UserRole, UserStatus } from "@prisma/client";

import { db } from "@/server/db/client";

type UserClient = Pick<Prisma.TransactionClient, "user">;

export async function findUserByEmail(email: string, client: UserClient = db) {
  return client.user.findFirst({ where: { email: email.trim().toLowerCase() } });
}

export async function findUserById(id: string, client: UserClient = db) {
  return client.user.findUnique({ where: { id } });
}

export async function incrementFailedLoginCount(userId: string, client: UserClient = db) {
  return client.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
  });
}

export async function blockUser(userId: string, client: UserClient = db) {
  return client.user.update({
    where: { id: userId },
    data: { status: "BLOCKED", blockedAt: new Date() },
  });
}

export async function resetFailedLoginCount(userId: string, client: UserClient = db) {
  return client.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lastLoginAt: new Date() },
  });
}

export async function updateUserPasswordHash(userId: string, passwordHash: string, client: UserClient = db) {
  return client.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; email?: string; role?: UserRole; status?: UserStatus },
  client: UserClient = db,
) {
  return client.user.update({ where: { id: userId }, data });
}

export function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  failedLoginCount: number;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    failedLoginCount: user.failedLoginCount,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
