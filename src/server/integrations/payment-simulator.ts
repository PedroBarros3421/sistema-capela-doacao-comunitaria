import type { PaymentSimulation, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { ConflictError, NotFoundError } from "@/server/http/errors";
import {
  documentSchema,
  emailSchema,
  moneySchema,
  phoneSchema,
} from "@/server/validation/common";

const destinationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PROJECT"), projectId: z.uuid() }).strict(),
  z.object({ type: z.literal("MOST_NEEDED") }).strict(),
]);

const donorIdentitySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    cpfCnpj: documentSchema.optional(),
  })
  .strict()
  .refine((identity) => Object.values(identity).some(Boolean), "Informe ao menos um dado do doador");

export const createSimulationSchema = z
  .object({
    idempotencyKey: z.uuid(),
    donationType: z.enum(["ONE_OFF", "MONTHLY"]),
    amount: moneySchema,
    method: z.enum(["PIX", "CARD"]),
    destination: destinationSchema,
    donor: donorIdentitySchema.optional(),
  })
  .strict()
  .refine((value) => value.donationType !== "MONTHLY" || value.donor, {
    message: "Doações mensais precisam de identificação",
    path: ["donor"],
  });

export type CreateSimulationInput = z.input<typeof createSimulationSchema>;
export type NormalizedDonorIdentity = z.output<typeof donorIdentitySchema>;
type SimulationClient = Pick<PrismaClient, "paymentSimulation" | "project">;

const SIMULATION_NOTICE = "Simulação demonstrativa: nenhum pagamento ou cobrança real será realizado.";

function comparableInput(input: z.output<typeof createSimulationSchema>) {
  return JSON.stringify({
    donationType: input.donationType,
    amount: input.amount,
    method: input.method,
    destination: input.destination,
    donor: input.donor ?? null,
  });
}

function comparableSimulation(simulation: PaymentSimulation) {
  return JSON.stringify({
    donationType: simulation.donationType,
    amount: simulation.amount.toFixed(2),
    method: simulation.method,
    destination: simulation.destinationType === "PROJECT"
      ? { type: "PROJECT", projectId: simulation.projectId }
      : { type: "MOST_NEEDED" },
    donor: simulation.submittedIdentity,
  });
}

export function serializePaymentSimulation(simulation: PaymentSimulation) {
  return {
    id: simulation.id,
    donationType: simulation.donationType,
    amount: simulation.amount.toFixed(2),
    currency: simulation.currency,
    method: simulation.method,
    status: simulation.status,
    destination: simulation.destinationType === "PROJECT"
      ? { type: "PROJECT" as const, projectId: simulation.projectId! }
      : { type: "MOST_NEEDED" as const },
    expiresAt: simulation.expiresAt.toISOString(),
    qrCodePayload: simulation.method === "PIX"
      ? `PIX-SIMULADO:${simulation.id}:${simulation.amount.toFixed(2)}`
      : null,
    simulationNotice: SIMULATION_NOTICE,
  };
}

export async function createPaymentSimulation(
  rawInput: CreateSimulationInput,
  client: SimulationClient = db,
) {
  const input = createSimulationSchema.parse(rawInput);
  const existing = await client.paymentSimulation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (comparableSimulation(existing) !== comparableInput(input)) {
      throw new ConflictError("A chave de idempotência já foi usada com outros dados");
    }
    return existing;
  }

  if (input.destination.type === "PROJECT") {
    const project = await client.project.findFirst({ where: { id: input.destination.projectId, status: "ACTIVE" } });
    if (!project) throw new NotFoundError("Projeto ativo não encontrado");
  }

  return client.paymentSimulation.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      donationType: input.donationType,
      amount: input.amount,
      method: input.method,
      status: "PENDING",
      destinationType: input.destination.type,
      projectId: input.destination.type === "PROJECT" ? input.destination.projectId : null,
      submittedIdentity: input.donor ?? undefined,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
}

export async function getPaymentSimulation(id: string, client: SimulationClient = db) {
  const simulation = await client.paymentSimulation.findUnique({ where: { id } });
  if (!simulation) throw new NotFoundError("Simulação não encontrada");
  if (simulation.status === "PENDING" && simulation.expiresAt <= new Date()) {
    return client.paymentSimulation.update({ where: { id }, data: { status: "EXPIRED" } });
  }
  return simulation;
}
