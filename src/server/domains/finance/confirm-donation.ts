import type { PaymentSimulation, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { createDonorAccessLink } from "@/server/auth/access-links";
import { db } from "@/server/db/client";
import { generateDonationReceipt } from "@/server/documents/donation-receipt";
import { matchDonor } from "@/server/domains/donors/match-donor";
import { ConflictError, GoneError, NotFoundError, ValidationError } from "@/server/http/errors";
import {
  type NormalizedDonorIdentity,
  serializePaymentSimulation,
} from "@/server/integrations/payment-simulator";

const confirmationSchema = z.object({
  simulationId: z.uuid(),
  confirmationKey: z.uuid(),
  outcome: z.enum(["CONFIRMED", "FAILED"]),
}).strict();

type ConfirmationOptions = {
  client?: PrismaClient;
  appUrl: string;
  storagePath?: string;
};

type TransactionResult = {
  simulation: PaymentSimulation;
  ledgerEntryId: string | null;
  subscriptionId: string | null;
  accountAccessUrl: string | null;
  donorReviewPending: boolean;
  donorDocument: string | null;
};

function nextMonthlyReference(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()));
}

function identityFrom(simulation: PaymentSimulation): NormalizedDonorIdentity | null {
  if (!simulation.submittedIdentity) return null;
  return simulation.submittedIdentity as NormalizedDonorIdentity;
}

async function existingResult(
  simulation: PaymentSimulation,
  client: Prisma.TransactionClient,
): Promise<TransactionResult> {
  const donor = simulation.donorId
    ? await client.donor.findUnique({ where: { id: simulation.donorId }, select: { document: true, reviewStatus: true } })
    : null;
  return {
    simulation,
    ledgerEntryId: simulation.ledgerEntryId,
    subscriptionId: simulation.recurringSubscriptionId,
    accountAccessUrl: null,
    donorReviewPending: donor?.reviewStatus === "PENDING_REVIEW",
    donorDocument: donor?.document ?? null,
  };
}

export async function confirmDonation(
  rawInput: unknown,
  options: ConfirmationOptions,
) {
  const input = confirmationSchema.parse(rawInput);
  const client = options.client ?? db;
  const result = await client.$transaction(async (tx): Promise<TransactionResult> => {
    const simulation = await tx.paymentSimulation.findUnique({ where: { id: input.simulationId } });
    if (!simulation) throw new NotFoundError("Simulação não encontrada");
    if (simulation.status === "CONFIRMED" || simulation.status === "FAILED") {
      if (simulation.confirmationKey && simulation.confirmationKey !== input.confirmationKey) {
        throw new ConflictError("A simulação já foi concluída com outra chave de confirmação");
      }
      return existingResult(simulation, tx);
    }
    if (simulation.status === "EXPIRED" || simulation.expiresAt <= new Date()) {
      if (simulation.status !== "EXPIRED") {
        await tx.paymentSimulation.update({ where: { id: simulation.id }, data: { status: "EXPIRED" } });
      }
      throw new GoneError("A simulação expirou; inicie uma nova doação");
    }
    if (simulation.status !== "PENDING" && simulation.status !== "CREATED") {
      throw new ConflictError("A simulação não pode ser confirmada neste estado");
    }
    if (input.outcome === "FAILED") {
      const failed = await tx.paymentSimulation.update({
        where: { id: simulation.id },
        data: { status: "FAILED", confirmationKey: input.confirmationKey },
      });
      return {
        simulation: failed,
        ledgerEntryId: null,
        subscriptionId: null,
        accountAccessUrl: null,
        donorReviewPending: false,
        donorDocument: null,
      };
    }

    const identity = identityFrom(simulation);
    if (simulation.donationType === "MONTHLY" && !identity) {
      throw new ValidationError("Doações mensais precisam de identificação");
    }
    const matched = await matchDonor(
      identity,
      simulation.donationType === "MONTHLY" ? "RECURRING" : "ONE_OFF",
      tx,
    );
    const now = new Date();
    const ledger = await tx.ledgerEntry.create({
      data: {
        type: "INCOME",
        amount: simulation.amount,
        currency: "BRL",
        occurredOn: now,
        donorId: matched?.donor.id,
        destinationType: simulation.destinationType,
        projectId: simulation.projectId,
        method: simulation.method,
        status: "CONFIRMED",
        origin: "PUBLIC",
        paymentSimulationId: simulation.id,
        confirmedAt: now,
      },
    });
    const subscription = simulation.donationType === "MONTHLY" && matched
      ? await tx.recurringSubscription.create({
          data: {
            donorId: matched.donor.id,
            amount: simulation.amount,
            currency: "BRL",
            method: simulation.method,
            status: "ACTIVE",
            nextChargeDate: nextMonthlyReference(now),
            destinationType: simulation.destinationType,
            projectId: simulation.projectId,
            paymentSimulationId: simulation.id,
          },
        })
      : null;
    const access = matched
      ? await createDonorAccessLink(matched.donor.id, options.appUrl, tx)
      : null;
    const confirmed = await tx.paymentSimulation.update({
      where: { id: simulation.id },
      data: {
        status: "CONFIRMED",
        confirmationKey: input.confirmationKey,
        donorId: matched?.donor.id,
        ledgerEntryId: ledger.id,
        recurringSubscriptionId: subscription?.id,
      },
    });
    return {
      simulation: confirmed,
      ledgerEntryId: ledger.id,
      subscriptionId: subscription?.id ?? null,
      accountAccessUrl: access?.url ?? null,
      donorReviewPending: matched?.reviewPending ?? false,
      donorDocument: matched?.donor.document ?? null,
    };
  }, { isolationLevel: "Serializable" });

  let receiptId: string | null = null;
  if (result.ledgerEntryId && result.donorDocument && options.storagePath) {
    receiptId = (await generateDonationReceipt(result.ledgerEntryId, {
      client,
      storagePath: options.storagePath,
    })).id;
  } else if (result.ledgerEntryId) {
    receiptId = (await client.donationReceipt.findUnique({
      where: { ledgerEntryId: result.ledgerEntryId },
      select: { id: true },
    }))?.id ?? null;
  }

  return {
    simulation: serializePaymentSimulation(result.simulation),
    ledgerEntryId: result.ledgerEntryId,
    subscriptionId: result.subscriptionId,
    receiptId,
    accountAccessUrl: result.accountAccessUrl,
    donorReviewPending: result.donorReviewPending,
    thankYouMessage: result.simulation.status === "CONFIRMED"
      ? "Obrigado por apoiar a missão da capela!"
      : "A simulação foi encerrada sem cobrança.",
  };
}
