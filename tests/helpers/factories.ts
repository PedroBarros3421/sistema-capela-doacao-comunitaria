import type {
  DonorRelationshipType,
  DonorReviewStatus,
  InventoryUnit,
  PaymentMethod,
  PrismaClient,
  ProjectStatus,
  RecurringSubscriptionStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";

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

export async function createDonor(
  client: PrismaClient,
  overrides: Partial<{
    name: string;
    email: string | null;
    phone: string | null;
    document: string | null;
    relationshipType: DonorRelationshipType;
    reviewStatus: DonorReviewStatus;
  }> = {},
) {
  sequence += 1;
  return client.donor.create({
    data: {
      name: overrides.name ?? `Doador ${sequence}`,
      email: overrides.email ?? `doador-${sequence}@example.org`,
      phone: overrides.phone ?? null,
      document: overrides.document ?? null,
      relationshipType: overrides.relationshipType ?? "ONE_OFF",
      origin: "PUBLIC",
      reviewStatus: overrides.reviewStatus ?? "CLEAR",
    },
  });
}

export async function createLedgerEntry(
  client: PrismaClient,
  createdById: string,
  overrides: Partial<{
    donorId: string;
    amount: string;
    occurredOn: string;
    projectId: string;
    method: PaymentMethod;
    status: "PENDING" | "CONFIRMED";
  }> = {},
) {
  return client.ledgerEntry.create({
    data: {
      type: "INCOME",
      amount: overrides.amount ?? "100.00",
      currency: "BRL",
      occurredOn: new Date(overrides.occurredOn ?? "2026-08-01"),
      donorId: overrides.donorId,
      destinationType: overrides.projectId ? "PROJECT" : "MOST_NEEDED",
      projectId: overrides.projectId,
      method: overrides.method ?? "PIX",
      status: overrides.status ?? "CONFIRMED",
      origin: "ADMIN",
      createdById,
      confirmedAt: (overrides.status ?? "CONFIRMED") === "CONFIRMED" ? new Date() : null,
    },
  });
}

export async function createRecurringSubscription(
  client: PrismaClient,
  donorId: string,
  overrides: Partial<{
    amount: string;
    status: RecurringSubscriptionStatus;
    method: PaymentMethod;
    projectId: string;
  }> = {},
) {
  const simulation = await client.paymentSimulation.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      donationType: "MONTHLY",
      amount: overrides.amount ?? "50.00",
      currency: "BRL",
      method: overrides.method ?? "PIX",
      status: "CONFIRMED",
      destinationType: overrides.projectId ? "PROJECT" : "MOST_NEEDED",
      projectId: overrides.projectId,
      donorId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return client.recurringSubscription.create({
    data: {
      donorId,
      amount: overrides.amount ?? "50.00",
      currency: "BRL",
      status: overrides.status ?? "ACTIVE",
      method: overrides.method ?? "PIX",
      nextChargeDate: new Date("2026-09-01"),
      destinationType: overrides.projectId ? "PROJECT" : "MOST_NEEDED",
      projectId: overrides.projectId,
      paymentSimulationId: simulation.id,
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
