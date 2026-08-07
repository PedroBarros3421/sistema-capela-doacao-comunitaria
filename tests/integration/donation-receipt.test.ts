import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { confirmDonation } from "@/server/domains/finance/confirm-donation";
import { generateDonationReceipt } from "@/server/documents/donation-receipt";
import { createPaymentSimulation } from "@/server/integrations/payment-simulator";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";

describe("donation identity, decimal value and receipt", () => {
  let database: DisposableDatabase;
  let storagePath: string;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    storagePath = await mkdtemp(join(tmpdir(), "capela-receipts-"));
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it("normalizes a valid CPF, preserves decimal money and generates one PDF", async () => {
    const simulation = await createPaymentSimulation(
      {
        idempotencyKey: randomUUID(),
        donationType: "ONE_OFF",
        amount: "1.234,56",
        method: "CARD",
        destination: { type: "MOST_NEEDED" },
        donor: { name: "João Souza", cpfCnpj: "529.982.247-25", email: "JOAO@example.org" },
      },
      database.client,
    );
    const confirmation = await confirmDonation(
      { simulationId: simulation.id, confirmationKey: randomUUID(), outcome: "CONFIRMED" },
      { client: database.client, appUrl: "http://localhost:3000" },
    );

    const first = await generateDonationReceipt(confirmation.ledgerEntryId!, {
      client: database.client,
      storagePath,
    });
    const repeated = await generateDonationReceipt(confirmation.ledgerEntryId!, {
      client: database.client,
      storagePath,
    });

    expect(first.id).toBe(repeated.id);
    expect((await database.client.ledgerEntry.findUniqueOrThrow({ where: { id: confirmation.ledgerEntryId! } })).amount.toFixed(2)).toBe("1234.56");
    expect((await database.client.donor.findFirstOrThrow({ where: { document: "52998224725" } })).email).toBe("joao@example.org");
    expect((await readFile(join(storagePath, first.filePath))).subarray(0, 4).toString()).toBe("%PDF");
    expect(await database.client.donationReceipt.count()).toBe(1);
  });

  it("keeps an anonymous donation anonymous and without a receipt", async () => {
    const simulation = await createPaymentSimulation(
      {
        idempotencyKey: randomUUID(),
        donationType: "ONE_OFF",
        amount: "10.00",
        method: "PIX",
        destination: { type: "MOST_NEEDED" },
      },
      database.client,
    );
    const confirmation = await confirmDonation(
      { simulationId: simulation.id, confirmationKey: randomUUID(), outcome: "CONFIRMED" },
      { client: database.client, appUrl: "http://localhost:3000" },
    );

    expect(confirmation.receiptId).toBeNull();
    expect((await database.client.ledgerEntry.findUniqueOrThrow({ where: { id: confirmation.ledgerEntryId! } })).donorId).toBeNull();
  });
});
