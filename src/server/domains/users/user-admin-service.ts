import type { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

import { revokeAllUserSessions } from "@/server/auth/auth-repository";
import { createInvitationLink } from "@/server/auth/password-links";
import { db } from "@/server/db/client";
import { serializeUser } from "@/server/domains/users/user-repository";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const createUserSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.email(),
    role: z.enum(["GENERAL_ADMIN", "FINANCE", "INVENTORY_VOLUNTEER"]),
  })
  .strict();

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    email: z.email().optional(),
    role: z.enum(["GENERAL_ADMIN", "FINANCE", "INVENTORY_VOLUNTEER"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .strict();

export type ListUsersFilter = { status?: UserStatus; role?: UserRole; page?: number; pageSize?: number };

export async function listUsers(filter: ListUsersFilter, client: PrismaClient = db) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const where = { ...(filter.status ? { status: filter.status } : {}), ...(filter.role ? { role: filter.role } : {}) };
  const [rows, total] = await Promise.all([
    client.user.findMany({ where, orderBy: [{ createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    client.user.count({ where }),
  ]);
  return { items: rows.map(serializeUser), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createUser(actorUserId: string, rawInput: unknown, appUrl: string, client: PrismaClient = db) {
  const input = createUserSchema.parse(rawInput);
  const email = input.email.trim().toLowerCase();
  return client.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { email } });
    if (existing) throw new ConflictError("Já existe um usuário com este e-mail");
    const user = await tx.user.create({
      data: { name: input.name, email, role: input.role, status: "PENDING", createdById: actorUserId },
    });
    const invitation = await createInvitationLink(user.id, appUrl, actorUserId, tx);
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "user.create",
      entityType: "User", entityId: user.id, outcome: "SUCCESS",
      metadata: { role: input.role }, allowedMetadataKeys: ["role"],
    }, tx);
    return { user: serializeUser(user), invitationUrl: invitation.url, deliveryStatus: "SIMULATED" as const };
  });
}

export async function updateUser(actorUserId: string, userId: string, rawInput: unknown, client: PrismaClient = db) {
  const input = updateUserSchema.parse(rawInput);
  if (Object.keys(input).length === 0) throw new ValidationError("Informe ao menos um campo para atualizar");
  return client.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError("Usuário não encontrado");
    if (input.email) {
      const email = input.email.trim().toLowerCase();
      const conflict = await tx.user.findFirst({ where: { email, id: { not: userId } } });
      if (conflict) throw new ConflictError("Já existe um usuário com este e-mail");
    }
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        email: input.email?.trim().toLowerCase(),
        role: input.role,
        status: input.status,
      },
    });
    if (input.status === "INACTIVE") await revokeAllUserSessions(userId, tx);
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "user.update",
      entityType: "User", entityId: userId, outcome: "SUCCESS",
      metadata: {}, allowedMetadataKeys: [],
    }, tx);
    return serializeUser(user);
  });
}

export async function unlockUser(actorUserId: string, userId: string, client: PrismaClient = db) {
  return client.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError("Usuário não encontrado");
    if (existing.status !== "BLOCKED") throw new ConflictError("O usuário não está bloqueado");
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", failedLoginCount: 0, blockedAt: null },
    });
    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "user.unlock",
      entityType: "User", entityId: userId, outcome: "SUCCESS",
      metadata: {}, allowedMetadataKeys: [],
    }, tx);
    return serializeUser(user);
  });
}
