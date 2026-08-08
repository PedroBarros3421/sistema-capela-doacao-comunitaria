import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { createDonorAccessLink, revokeDonorAccessLinks } from "@/server/auth/access-links";
import { db } from "@/server/db/client";
import { simulateNotification } from "@/server/integrations/notification-simulator";

import { getDonorDetail } from "./donor-query-service";
import { serializeSubscription } from "./subscription-service";

const accessRequestSchema = z.object({
  identifierType: z.enum(["CPF_CNPJ", "PIX_REFERENCE"]),
  identifier: z.string().min(1).max(100),
  contact: z.string().min(3).max(254),
}).strict();

const GENERIC_RESPONSE = {
  message: "Se os dados informados corresponderem a um cadastro, você receberá as instruções em breve.",
  deliveryStatus: "SIMULATED" as const,
};

function normalizeContact(contact: string): string {
  return contact.trim().toLowerCase();
}

function contactMatches(donor: { email: string | null; phone: string | null }, contact: string): boolean {
  const normalized = normalizeContact(contact);
  if (donor.email && donor.email.toLowerCase() === normalized) return true;
  if (donor.phone && donor.phone.replace(/\D/g, "") === contact.replace(/\D/g, "")) return true;
  return false;
}

export async function requestDonorAccountAccess(
  rawInput: unknown,
  appUrl: string,
  client: PrismaClient = db,
) {
  const input = accessRequestSchema.parse(rawInput);

  let donorId: string | null = null;
  if (input.identifierType === "CPF_CNPJ") {
    const document = input.identifier.replace(/\D/g, "");
    const donor = await client.donor.findFirst({ where: { document } });
    donorId = donor?.id ?? null;
  } else {
    const simulation = z.uuid().safeParse(input.identifier).success
      ? await client.paymentSimulation.findUnique({ where: { id: input.identifier } })
      : null;
    donorId = simulation?.donorId ?? null;
  }

  if (donorId) {
    const donor = await client.donor.findUnique({ where: { id: donorId } });
    if (donor && contactMatches(donor, input.contact)) {
      await revokeDonorAccessLinks(donor.id, client);
      const access = await createDonorAccessLink(donor.id, appUrl, client);
      simulateNotification({
        type: "DONOR_ACCOUNT_ACCESS",
        to: input.contact,
        payload: { accessUrl: access.url },
      });
    }
  }

  return GENERIC_RESPONSE;
}

export async function getDonorAccount(donorId: string, client: PrismaClient = db) {
  const detail = await getDonorDetail(donorId, client);
  if (!detail) return null;

  const [donations, subscriptions] = await Promise.all([
    client.ledgerEntry.findMany({
      where: { donorId, type: "INCOME", status: "CONFIRMED" },
      orderBy: { occurredOn: "desc" },
      include: { project: { select: { name: true } }, receipt: { select: { id: true } } },
    }),
    client.recurringSubscription.findMany({ where: { donorId }, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    donor: {
      name: detail.name,
      email: detail.email,
      phone: detail.phone,
      documentMasked: detail.documentMasked,
    },
    donations: donations.map((entry) => ({
      id: entry.id,
      occurredOn: entry.occurredOn.toISOString().slice(0, 10),
      amount: entry.amount.toFixed(2),
      projectName: entry.project?.name ?? "Mais necessário",
      receiptId: entry.receipt?.id ?? null,
    })),
    subscriptions: subscriptions.map(serializeSubscription),
  };
}
