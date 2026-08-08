import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resetServerEnvForTests } from "@/server/config/env";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createProject } from "../helpers/factories";

describe("public donation routes with real PostgreSQL", () => {
  let database: DisposableDatabase;
  let projectId: string;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    projectId = (await createProject(database.client, { name: "Assistência às Famílias" })).id;
    Object.assign(process.env, {
      DATABASE_URL: database.connectionString,
      APP_URL: "http://localhost:3000",
      DOCUMENT_STORAGE_PATH: "./storage",
      CHAPEL_NAME: "Capela Comunitária",
      CHAPEL_CONTACT_EMAIL: "contato@example.org",
      CHAPEL_CONTACT_PHONE: "5585999999999",
      SEED_ADMIN_EMAIL: "admin@example.org",
      SEED_ADMIN_PASSWORD: "test-only-admin-password-1",
    });
    resetServerEnvForTests();
  });

  afterAll(async () => {
    const { db } = await import("@/server/db/client");
    await db.$disconnect();
    await database.cleanup();
  });

  it("loads an active project and confirms a simulated donation through real handlers", async () => {
    const { GET: getConfiguration } = await import("@/app/api/public/configuration/route");
    const configurationResponse = await getConfiguration();
    const configuration = await configurationResponse.json();

    expect(configurationResponse.status).toBe(200);
    expect(configuration.data.projects).toContainEqual({ id: projectId, name: "Assistência às Famílias" });

    const { POST: createSimulation } = await import("@/app/api/public/payment-simulations/route");
    const simulationResponse = await createSimulation(new Request("http://localhost/api/public/payment-simulations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        donationType: "ONE_OFF",
        amount: "50.00",
        method: "PIX",
        destination: { type: "PROJECT", projectId },
      }),
    }));
    const simulation = await simulationResponse.json();

    expect(simulationResponse.status).toBe(201);
    expect(simulation.data.status).toBe("PENDING");

    const { POST: confirmSimulation } = await import("@/app/api/public/payment-simulations/[simulationId]/confirmation/route");
    const confirmationResponse = await confirmSimulation(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ outcome: "CONFIRMED" }),
    }), { params: Promise.resolve({ simulationId: simulation.data.id }) });
    const confirmation = await confirmationResponse.json();

    expect(confirmationResponse.status).toBe(200);
    expect(confirmation.data.simulation.status).toBe("CONFIRMED");
    expect(confirmation.data.ledgerEntryId).toEqual(expect.any(String));
    expect(await database.client.ledgerEntry.count()).toBe(1);
  });
});
