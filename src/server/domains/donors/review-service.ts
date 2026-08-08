import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { appendAuditEvent } from "@/server/observability/audit";

const resolutionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("KEEP_SEPARATE"),
    note: z.string().min(1).max(1000),
  }).strict(),
  z.object({
    decision: z.literal("MERGE"),
    survivingDonorId: z.uuid(),
    note: z.string().min(1).max(1000),
  }).strict(),
]);

export type ReviewResolutionInput = z.infer<typeof resolutionSchema>;

const DONOR_REFERENCE_MODELS = [
  "ledgerEntry",
  "paymentSimulation",
  "recurringSubscription",
  "donationReceipt",
  "inventoryLot",
  "accessLink",
] as const;

export function serializeDonorMatchReview(review: {
  id: string;
  submittedDonorId: string;
  candidateDonorIds: string[];
  reason: string;
  status: string;
  openedAt: Date;
  resolvedAt: Date | null;
  resolvedById: string | null;
  resolutionNote: string | null;
}) {
  return {
    id: review.id,
    submittedDonorId: review.submittedDonorId,
    candidateDonorIds: review.candidateDonorIds,
    reason: review.reason,
    status: review.status,
    openedAt: review.openedAt.toISOString(),
    resolvedAt: review.resolvedAt?.toISOString() ?? null,
    resolvedById: review.resolvedById,
    resolutionNote: review.resolutionNote,
  };
}

export async function listDonorMatchReviews(
  status: "OPEN" | "KEEP_SEPARATE" | "MERGED" | undefined,
  pagination: { page?: number; pageSize?: number },
  client: PrismaClient = db,
) {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 20));
  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    client.donorMatchReview.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    client.donorMatchReview.count({ where }),
  ]);

  return {
    items: rows.map(serializeDonorMatchReview),
    total,
    page,
    pageSize,
  };
}

export async function resolveDonorMatchReview(
  actorUserId: string,
  reviewId: string,
  rawInput: unknown,
  client: PrismaClient = db,
) {
  const input = resolutionSchema.parse(rawInput);

  const result = await client.$transaction(async (tx) => {
    const review = await tx.donorMatchReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError("Revisão não encontrada");
    if (review.status !== "OPEN") throw new ConflictError("A revisão já foi resolvida");

    if (input.decision === "MERGE" && !review.candidateDonorIds.includes(input.survivingDonorId)) {
      throw new ValidationError("O doador sobrevivente deve ser um dos candidatos da revisão");
    }

    if (input.decision === "MERGE") {
      await mergeDonor(tx, review.submittedDonorId, input.survivingDonorId);
    }

    await tx.donor.update({
      where: { id: review.submittedDonorId },
      data: { reviewStatus: "CLEAR" },
    });

    const resolved = await tx.donorMatchReview.update({
      where: { id: reviewId },
      data: {
        status: input.decision === "MERGE" ? "MERGED" : "KEEP_SEPARATE",
        resolvedAt: new Date(),
        resolvedById: actorUserId,
        resolutionNote: input.note,
      },
    });

    await appendAuditEvent(
      {
        actorKind: "USER",
        actorUserId,
        action: "donor.match_review.resolve",
        entityType: "DonorMatchReview",
        entityId: reviewId,
        outcome: "SUCCESS",
        metadata: { decision: input.decision, survivingDonorId: input.decision === "MERGE" ? input.survivingDonorId : null },
        allowedMetadataKeys: ["decision", "survivingDonorId"],
      },
      tx,
    );

    return resolved;
  });

  return serializeDonorMatchReview(result);
}

async function mergeDonor(tx: Prisma.TransactionClient, provisionalDonorId: string, survivingDonorId: string) {
  for (const model of DONOR_REFERENCE_MODELS) {
    await (tx[model] as Prisma.TransactionClient["ledgerEntry"]).updateMany({
      where: { donorId: provisionalDonorId },
      data: { donorId: survivingDonorId },
    });
  }

  await tx.donor.update({
    where: { id: provisionalDonorId },
    data: { mergedIntoId: survivingDonorId },
  });
}
