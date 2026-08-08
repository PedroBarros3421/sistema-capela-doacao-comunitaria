import type { InventoryUnit, PrismaClient, ProjectStatus, UserRole, UserStatus } from "@prisma/client";

import { hashPassword } from "../../src/server/auth/crypto";

let sequence = 0;

export async function createUser(
  client: PrismaClient,
  overrides: Partial<{
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    password: string;
    blockedAt: Date;
  }> = {},
) {
  sequence += 1;
  const status = overrides.status ?? "ACTIVE";
  const password = overrides.password ?? "secure-test-password-1";
  return client.user.create({
    data: {
      name: overrides.name ?? `Usuário ${sequence}`,
      email: overrides.email ?? `user-${sequence}@example.org`,
      role: overrides.role ?? "GENERAL_ADMIN",
      status,
      passwordHash: await hashPassword(password),
      // DB enforces: status = 'BLOCKED' ↔ blocked_at IS NOT NULL
      blockedAt: overrides.blockedAt ?? (status === "BLOCKED" ? new Date() : undefined),
    },
  });
}

export async function createProject(
  client: PrismaClient,
  overrides: Partial<{ name: string; status: ProjectStatus }> = {},
) {
  sequence += 1;
  return client.project.create({
    data: {
      name: overrides.name ?? `Projeto ${sequence}`,
      status: overrides.status ?? "ACTIVE",
    },
  });
}

export async function createInventoryItem(
  client: PrismaClient,
  userId: string,
  overrides: Partial<{ name: string; category: string; unit: InventoryUnit; averageUnitValue: string }> = {},
) {
  sequence += 1;
  return client.inventoryItem.create({
    data: {
      name: overrides.name ?? `Item ${sequence}`,
      category: overrides.category ?? "Alimentos",
      unit: overrides.unit ?? "UNIT",
      averageUnitValue: overrides.averageUnitValue ?? "5.00",
      acceptedConfig: { create: { accepted: true, priority: false, updatedById: userId } },
    },
  });
}

export async function createInventoryLot(
  client: PrismaClient,
  itemId: string,
  userId: string,
  overrides: Partial<{ quantity: string; receivedOn: string; expiresOn: string | null }> = {},
) {
  const quantity = overrides.quantity ?? "10.000";
  return client.inventoryLot.create({
    data: {
      itemId,
      receivedQuantity: quantity,
      availableQuantity: quantity,
      receivedOn: new Date(overrides.receivedOn ?? "2026-08-01"),
      expiresOn: overrides.expiresOn ? new Date(overrides.expiresOn) : null,
      estimatedValue: "50.00",
      valuationSource: "AVERAGE_AT_RECEIPT",
      unitValueSnapshot: "5.00",
      createdById: userId,
    },
  });
}
