import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import type { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/server/db/client";
import { NotFoundError } from "@/server/http/errors";

type TermOptions = { client?: PrismaClient; storagePath: string };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

async function buildTermPdf(lot: Awaited<ReturnType<typeof loadLot>>) {
  if (!lot) throw new NotFoundError("Lote não encontrado");
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  page.drawText("Termo de doação de bens", { x: 56, y: 760, size: 22, font: bold, color: rgb(0.14, 0.36, 0.13) });
  page.drawText(`Item: ${lot.item.name} (${lot.item.category})`, { x: 56, y: 710, size: 12, font: regular });
  page.drawText(`Quantidade recebida: ${lot.receivedQuantity.toFixed(3)} ${lot.item.unit}`, { x: 56, y: 685, size: 12, font: regular });
  page.drawText(`Valor estimado: BRL ${lot.estimatedValue.toFixed(2)}`, { x: 56, y: 660, size: 12, font: regular });
  page.drawText(`Doador: ${lot.donor?.name ?? lot.donorNameSnapshot ?? "Não informado"}`, { x: 56, y: 635, size: 12, font: regular });
  page.drawText(`Recebimento: ${formatDate(lot.receivedOn)}`, { x: 56, y: 610, size: 12, font: regular });
  page.drawText(`Lote: ${lot.id}`, { x: 56, y: 585, size: 10, font: regular });
  page.drawText("Documento gerado a partir do lote persistido.", { x: 56, y: 530, size: 11, font: regular });
  return document.save();
}

function loadLot(client: PrismaClient, lotId: string) {
  return client.inventoryLot.findUnique({ where: { id: lotId }, include: { item: true, donor: true } });
}

export async function generateInKindTerm(lotId: string, options: TermOptions) {
  const client = options.client ?? db;
  const existing = await client.inKindDonationTerm.findUnique({ where: { lotId } });
  if (existing) return serializeTerm(existing);
  const lot = await loadLot(client, lotId);
  if (!lot) throw new NotFoundError("Lote não encontrado");

  const bytes = await buildTermPdf(lot);
  const relativePath = join("in-kind-terms", `${lot.id}.pdf`);
  const targetPath = join(options.storagePath, relativePath);
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, targetPath);

  const term = await client.inKindDonationTerm.create({
    data: {
      lotId: lot.id,
      descriptionSnapshot: `${lot.item.name} (${lot.item.category}) — ${lot.receivedQuantity.toFixed(3)} ${lot.item.unit}`,
      estimatedValueSnapshot: lot.estimatedValue,
      donorSnapshot: { name: lot.donor?.name ?? lot.donorNameSnapshot ?? null },
      filePath: relativePath,
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
    },
  });
  return serializeTerm(term);
}

export async function readInKindTermFile(termId: string, options: TermOptions) {
  const client = options.client ?? db;
  const term = await client.inKindDonationTerm.findUnique({ where: { id: termId } });
  if (!term) throw new NotFoundError("Termo não encontrado");
  const storageRoot = resolve(options.storagePath);
  const filePath = resolve(storageRoot, term.filePath);
  if (!filePath.startsWith(`${storageRoot}${sep}`)) throw new NotFoundError("Termo não encontrado");
  return { term, bytes: await readFile(filePath) };
}

function serializeTerm(term: { id: string; generatedAt: Date }) {
  return { id: term.id, generatedAt: term.generatedAt.toISOString(), downloadUrl: `/api/admin/documents/terms/${term.id}.pdf` };
}
