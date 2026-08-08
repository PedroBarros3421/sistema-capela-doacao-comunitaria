import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { db } from "@/server/db/client";
import { generateAccountabilityReportPdf } from "@/server/documents/accountability-report";
import { appendAuditEvent } from "@/server/observability/audit";
import { buildReportSnapshot, reportPeriodSchema } from "@/server/domains/reports/report-service";

const publishSchema = reportPeriodSchema.extend({ generatePdf: z.boolean().default(true) }).strict();

function sanitizeSnapshot(snapshot: Awaited<ReturnType<typeof buildReportSnapshot>>) {
  return {
    from: snapshot.from,
    to: snapshot.to,
    category: snapshot.category,
    totals: snapshot.totals,
    byProject: snapshot.byProject.map((entry) => ({
      projectName: entry.projectName,
      moneyRaised: entry.moneyRaised,
      moneySpent: entry.moneySpent,
    })),
    inventory: {
      activeItemCount: snapshot.inventory.activeItemCount,
      turnoverByItem: snapshot.inventory.turnoverByItem.map((item) => ({
        itemName: item.itemName,
        category: item.category,
        receivedQuantity: item.receivedQuantity,
        distributedQuantity: item.distributedQuantity,
        turnoverRate: item.turnoverRate,
      })),
      expiredQuantity: snapshot.inventory.expiredQuantity,
      discardedQuantity: snapshot.inventory.discardedQuantity,
      discardedValue: snapshot.inventory.discardedValue,
    },
  };
}

export type PublicReportSnapshot = ReturnType<typeof sanitizeSnapshot>;

type PublishOptions = { client?: PrismaClient; storagePath: string };

export async function publishReport(actorUserId: string, rawInput: unknown, options: PublishOptions) {
  const client = options.client ?? db;
  const input = publishSchema.parse(rawInput);
  const snapshot = await buildReportSnapshot(input, client);
  const sanitized = sanitizeSnapshot(snapshot);

  return client.$transaction(async (tx) => {
    const previousLatest = await tx.publicReportPublication.findFirst({
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });

    const publication = await tx.publicReportPublication.create({
      data: {
        periodStart: new Date(input.from),
        periodEnd: new Date(input.to),
        categoryFilter: input.category,
        snapshot: sanitized,
        publishedById: actorUserId,
        supersedesId: previousLatest?.id,
      },
    });

    let generatedPdfPath: string | null = null;
    if (input.generatePdf) {
      const { relativePath } = await generateAccountabilityReportPdf(publication.id, sanitized, options.storagePath);
      generatedPdfPath = relativePath;
      await tx.publicReportPublication.update({ where: { id: publication.id }, data: { generatedPdfPath } });
    }

    await appendAuditEvent({
      actorUserId, actorKind: "USER", action: "report.publication.create",
      entityType: "PublicReportPublication", entityId: publication.id, outcome: "SUCCESS",
      metadata: { from: input.from, to: input.to },
      allowedMetadataKeys: ["from", "to"],
    }, tx);

    return serializePublication({ ...publication, generatedPdfPath });
  });
}

export async function listPublications(client: PrismaClient = db) {
  const publications = await client.publicReportPublication.findMany({
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
  });
  return publications.map(serializePublication);
}

export async function getLatestPublication(client: PrismaClient = db) {
  return client.publicReportPublication.findFirst({
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
  });
}

function serializePublication(publication: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  categoryFilter: string | null;
  snapshot: unknown;
  generatedPdfPath: string | null;
  publishedById: string;
  publishedAt: Date;
  supersedesId: string | null;
}) {
  return {
    id: publication.id,
    from: publication.periodStart.toISOString().slice(0, 10),
    to: publication.periodEnd.toISOString().slice(0, 10),
    category: publication.categoryFilter,
    snapshot: publication.snapshot as PublicReportSnapshot,
    publishedBy: publication.publishedById,
    publishedAt: publication.publishedAt.toISOString(),
    hasPdf: Boolean(publication.generatedPdfPath),
  };
}

export type SerializedPublication = ReturnType<typeof serializePublication>;
