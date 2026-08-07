import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { confirmDonation } from "@/server/domains/finance/confirm-donation";
import { createPaymentSimulation } from "@/server/integrations/payment-simulator";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createProject } from "../helpers/factories";

describe("public donation confirmation", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it("atomically confirms a monthly donation and is idempotent", async () => {
    const project = await createProject(database.client);
    const simulation = await createPaymentSimulation(
      {
        idempotencyKey: randomUUID(),
        donationType: "MONTHLY",
        amount: "50.00",
        method: "PIX",
        destination: { type: "PROJECT", projectId: project.id },
        donor: { name: "Maria Silva", email: "MARIA@EXAMPLE.ORG", phone: "(85) 99999-0000" },
      },
      database.client,
    );
    const confirmationKey = randomUUID();

    const first = await confirmDonation(
      { simulationId: simulation.id, confirmationKey, outcome: "CONFIRMED" },
      { client: database.client, appUrl: "http://localhost:3000" },
    );
    const repeated = await confirmDonation(
      { simulationId: simulation.id, confirmationKey, outcome: "CONFIRMED" },
      { client: database.client, appUrl: "http://localhost:3000" },
    );

    expect(first.ledgerEntryId).toBe(repeated.ledgerEntryId);
    expect(first.subscriptionId).toBe(repeated.subscriptionId);
    expect(first.accountAccessUrl).toMatch(/^http:\/\/localhost:3000\/doar\/minha-conta\?token=/);
    expect(repeated.accountAccessUrl).toBeNull();
    expect(await database.client.donor.count()).toBe(1);
    expect(await database.client.ledgerEntry.count()).toBe(1);
    expect(await database.client.recurringSubscription.count()).toBe(1);
    expect(await database.client.accessLink.count()).toBe(1);
  });

  it("rolls back every donation record when monthly identity is absent", async () => {
    const simulation = await database.client.paymentSimulation.create({
      data: {
        idempotencyKey: randomUUID(),
        donationType: "MONTHLY",
        amount: "25.00",
        method: "CARD",
        status: "PENDING",
        destinationType: "MOST_NEEDED",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(
      confirmDonation(
        { simulationId: simulation.id, confirmationKey: randomUUID(), outcome: "CONFIRMED" },
        { client: database.client, appUrl: "http://localhost:3000" },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(await database.client.ledgerEntry.count({ where: { paymentSimulationId: simulation.id } })).toBe(0);
    expect(await database.client.recurringSubscription.count({ where: { paymentSimulationId: simulation.id } })).toBe(0);
    expect((await database.client.paymentSimulation.findUniqueOrThrow({ where: { id: simulation.id } })).status).toBe("PENDING");
  });
});
