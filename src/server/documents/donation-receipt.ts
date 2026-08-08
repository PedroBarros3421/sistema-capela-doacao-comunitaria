import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import type { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/server/db/client";
import { ConflictError, NotFoundError } from "@/server/http/errors";

type ReceiptOptions = {
  client?: PrismaClient;
  storagePath: string;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza" }).format(date);
}

async function buildReceiptPdf(entry: {
  id: string;
  amount: { toFixed(fractionDigits?: number): string };
  currency: string;
  confirmedAt: Date | null;
  donor: { name: string; document: string | null } | null;
}) {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  page.drawText("Recibo de doação", { x: 56, y: 760, size: 22, font: bold, color: rgb(0.14, 0.36, 0.13) });
  page.drawText(`Doador: ${entry.donor?.name ?? ""}`, { x: 56, y: 710, size: 12, font: regular });
  page.drawText(`CPF/CNPJ: ${entry.donor?.document ?? ""}`, { x: 56, y: 685, size: 12, font: regular });
  page.drawText(`Valor: ${entry.currency} ${entry.amount.toFixed(2)}`, { x: 56, y: 660, size: 12, font: regular });
  page.drawText(`Confirmação: ${formatDate(entry.confirmedAt ?? new Date())}`, { x: 56, y: 635, size: 12, font: regular });
  page.drawText(`Lançamento: ${entry.id}`, { x: 56, y: 610, size: 10, font: regular });
  page.drawText("Documento gerado a partir do registro financeiro confirmado.", { x: 56, y: 555, size: 11, font: regular });
  return document.save();
}

export async function generateDonationReceipt(entryId: string, options: ReceiptOptions) {
  const client = options.client ?? db;
  const existing = await client.donationReceipt.findUnique({ where: { ledgerEntryId: entryId } });
  if (existing) return existing;

  const entry = await client.ledgerEntry.findUnique({
    where: { id: entryId },
    include: { donor: true },
  });
  if (!entry) throw new NotFoundError("Lançamento não encontrado");
  if (entry.type !== "INCOME" || entry.status !== "CONFIRMED" || !entry.donor?.document) {
    throw new ConflictError("O recibo exige uma entrada confirmada com CPF ou CNPJ");
  }

  const bytes = await buildReceiptPdf(entry);
  const relativePath = join("donation-receipts", `${entry.id}.pdf`);
  const targetPath = join(options.storagePath, relativePath);
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, targetPath);

  return client.donationReceipt.create({
    data: {
      ledgerEntryId: entry.id,
      donorId: entry.donor.id,
      documentSnapshot: entry.donor.document,
      filePath: relativePath,
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
    },
  });
}

export async function readDonationReceiptFile(receiptId: string, options: ReceiptOptions) {
  const client = options.client ?? db;
  const receipt = await client.donationReceipt.findUnique({ where: { id: receiptId } });
  if (!receipt) throw new NotFoundError("Recibo não encontrado");
  const storageRoot = resolve(options.storagePath);
  const filePath = resolve(storageRoot, receipt.filePath);
  if (!filePath.startsWith(`${storageRoot}${sep}`)) throw new NotFoundError("Recibo não encontrado");
  return { receipt, bytes: await readFile(filePath) };
}
