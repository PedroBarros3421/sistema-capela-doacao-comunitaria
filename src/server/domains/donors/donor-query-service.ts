import type { PrismaClient } from "@prisma/client";

import { db } from "@/server/db/client";

export type DonorFilter = {
  query?: string;
  relationshipType?: "ONE_OFF" | "RECURRING" | "IN_KIND";
  reviewStatus?: "CLEAR" | "PENDING_REVIEW";
};

export function maskDocument(document: string | null): string | null {
  if (!document) return null;
  const visible = document.slice(-2);
  return `${"*".repeat(Math.max(document.length - 2, 0))}${visible}`;
}

export function serializeDonorSummary(donor: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationshipType: string;
  origin: string;
  reviewStatus: string;
}) {
  return {
    id: donor.id,
    name: donor.name,
    email: donor.email,
    phone: donor.phone,
    relationshipType: donor.relationshipType,
    origin: donor.origin,
    reviewStatus: donor.reviewStatus,
  };
}

export async function listDonors(
  filter: DonorFilter,
  pagination: { page?: number; pageSize?: number },
  client: PrismaClient = db,
) {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 20));

  const where = {
    ...(filter.relationshipType ? { relationshipType: filter.relationshipType } : {}),
    ...(filter.reviewStatus ? { reviewStatus: filter.reviewStatus } : {}),
    ...(filter.query
      ? {
          OR: [
            { name: { contains: filter.query, mode: "insensitive" as const } },
            { email: { contains: filter.query, mode: "insensitive" as const } },
            { phone: { contains: filter.query } },
            { document: { contains: filter.query } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    client.donor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    client.donor.count({ where }),
  ]);

  return {
    items: rows.map(serializeDonorSummary),
    total,
    page,
    pageSize,
  };
}

export async function getDonorDetail(donorId: string, client: PrismaClient = db) {
  const donor = await client.donor.findUnique({ where: { id: donorId } });
  if (!donor) return null;

  const [ledgerEntries, inventoryLots, subscriptions] = await Promise.all([
    client.ledgerEntry.findMany({
      where: { donorId, type: "INCOME", status: "CONFIRMED" },
      orderBy: { occurredOn: "desc" },
      include: { project: { select: { name: true } } },
    }),
    client.inventoryLot.findMany({
      where: { donorId },
      orderBy: { receivedOn: "desc" },
      include: { item: { select: { name: true, unit: true } } },
    }),
    client.recurringSubscription.findMany({
      where: { donorId },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { name: true } } },
    }),
  ]);

  const timeline = [
    ...ledgerEntries.map((entry) => ({
      type: "DONATION" as const,
      id: entry.id,
      occurredOn: entry.occurredOn.toISOString().slice(0, 10),
      amount: entry.amount.toFixed(2),
      projectName: entry.project?.name ?? "Mais necessário",
    })),
    ...inventoryLots.map((lot) => ({
      type: "IN_KIND" as const,
      id: lot.id,
      occurredOn: lot.receivedOn.toISOString().slice(0, 10),
      quantity: lot.receivedQuantity.toFixed(3),
      itemName: lot.item.name,
      unit: lot.item.unit,
    })),
  ].sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));

  return {
    ...serializeDonorSummary(donor),
    documentMasked: maskDocument(donor.document),
    timeline,
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      amount: subscription.amount.toFixed(2),
      currency: subscription.currency,
      status: subscription.status,
      method: subscription.method,
      nextChargeDate: subscription.nextChargeDate?.toISOString().slice(0, 10) ?? null,
      destination: subscription.destinationType === "PROJECT" && subscription.projectId
        ? { type: "PROJECT" as const, projectId: subscription.projectId }
        : { type: "MOST_NEEDED" as const },
    })),
  };
}
