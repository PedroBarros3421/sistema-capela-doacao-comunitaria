import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { NotFoundError } from "@/server/http/errors";
import type { PublicReportSnapshot } from "@/server/domains/reports/publication-service";

async function buildAccountabilityPdf(publicationId: string, snapshot: PublicReportSnapshot) {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let y = 770;
  const line = (text: string, size = 12, font = regular) => {
    page.drawText(text, { x: 56, y, size, font });
    y -= size + 10;
  };
  page.drawText("Prestação de contas", { x: 56, y, size: 22, font: bold, color: rgb(0.14, 0.36, 0.13) });
  y -= 40;
  line(`Período: ${snapshot.from} a ${snapshot.to}`);
  if (snapshot.category) line(`Categoria: ${snapshot.category}`);
  line(`Total arrecadado: BRL ${snapshot.totals.moneyRaised}`, 14, bold);
  line(`Total gasto: BRL ${snapshot.totals.moneySpent}`, 14, bold);
  line(`Bens recebidos (estimado): BRL ${snapshot.totals.inKindReceived}`, 14, bold);
  y -= 10;
  line("Por projeto:", 13, bold);
  for (const project of snapshot.byProject) {
    line(`${project.projectName}: arrecadado BRL ${project.moneyRaised} · gasto BRL ${project.moneySpent}`, 11);
  }
  y -= 10;
  line("Estoque:", 13, bold);
  line(`Itens ativos: ${snapshot.inventory.activeItemCount}`, 11);
  line(`Quantidade vencida: ${snapshot.inventory.expiredQuantity}`, 11);
  line(`Quantidade descartada: ${snapshot.inventory.discardedQuantity}`, 11);
  line(`Valor descartado: BRL ${snapshot.inventory.discardedValue}`, 11);
  page.drawText(`Publicação: ${publicationId}`, { x: 56, y: 40, size: 9, font: regular });
  return document.save();
}

export async function generateAccountabilityReportPdf(
  publicationId: string,
  snapshot: PublicReportSnapshot,
  storagePath: string,
) {
  const bytes = await buildAccountabilityPdf(publicationId, snapshot);
  const relativePath = join("accountability-reports", `${publicationId}.pdf`);
  const targetPath = join(storagePath, relativePath);
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, targetPath);
  return { relativePath, bytes };
}

export async function readLatestAccountabilityReportFile(relativePath: string, storagePath: string) {
  const storageRoot = resolve(storagePath);
  const filePath = resolve(storageRoot, relativePath);
  if (!filePath.startsWith(`${storageRoot}${sep}`)) throw new NotFoundError("Relatório não encontrado");
  return readFile(filePath);
}
