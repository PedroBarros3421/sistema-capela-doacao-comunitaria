import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const projectId = randomUUID();
const simulationId = randomUUID();
const simulation = {
  id: simulationId,
  donationType: "ONE_OFF" as const,
  amount: "50.00",
  currency: "BRL",
  method: "PIX" as const,
  status: "PENDING" as const,
  destination: { type: "PROJECT" as const, projectId },
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  qrCodePayload: `PIX-SIMULADO:${simulationId}:50.00`,
  simulationNotice: "Simulação demonstrativa: nenhum pagamento ou cobrança real será realizado.",
};

const mocks = vi.hoisted(() => ({
  configuration: vi.fn(),
  startSimulation: vi.fn(),
  getSimulation: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@/server/config/public-config", () => ({ getPublicConfiguration: mocks.configuration }));
vi.mock("@/server/integrations/payment-simulator", () => ({
  startPaymentSimulation: mocks.startSimulation,
  getPaymentSimulation: mocks.getSimulation,
  serializePaymentSimulation: (value: unknown) => value,
}));
vi.mock("@/server/domains/finance/confirm-donation", () => ({ confirmDonation: mocks.confirm }));
vi.mock("@/server/config/env", () => ({
  getServerEnv: () => ({ APP_URL: "http://localhost:3000", DOCUMENT_STORAGE_PATH: "./storage" }),
}));

describe("public donation HTTP contract", () => {
  beforeEach(() => {
    mocks.configuration.mockResolvedValue({
      projects: [{ id: projectId, name: "Assistência às Famílias" }],
      volunteerHelp: { label: "Chamar um voluntário", contact: "5585999999999" },
      itemDelivery: { address: "Capela", instructions: "Entrega presencial" },
    });
    mocks.startSimulation.mockResolvedValue({ simulation, created: true });
    mocks.getSimulation.mockResolvedValue(simulation);
    mocks.confirm.mockResolvedValue({
      simulation: { ...simulation, status: "CONFIRMED" },
      ledgerEntryId: randomUUID(),
      subscriptionId: null,
      receiptId: null,
      accountAccessUrl: null,
      donorReviewPending: false,
      thankYouMessage: "Obrigado por apoiar a missão da capela!",
    });
  });

  it("returns public configuration with active project and volunteer help", async () => {
    const { GET } = await import("@/app/api/public/configuration/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.projects[0]).toEqual({ id: projectId, name: "Assistência às Famílias" });
    expect(body.data.volunteerHelp.label).toBe("Chamar um voluntário");
  });

  it("requires idempotency and creates a clearly simulated payment", async () => {
    const { POST } = await import("@/app/api/public/payment-simulations/route");
    const response = await POST(new Request("http://localhost/api/public/payment-simulations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({
        donationType: "ONE_OFF",
        amount: "50.00",
        method: "PIX",
        destination: { type: "PROJECT", projectId },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.qrCodePayload).toContain("PIX-SIMULADO");
    expect(body.data.simulationNotice).toContain("nenhum pagamento");
    expect(mocks.startSimulation).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: expect.any(String) }));
  });

  it("reads and confirms a simulation using async route params", async () => {
    const { GET } = await import("@/app/api/public/payment-simulations/[simulationId]/route");
    const readResponse = await GET(new Request("http://localhost"), { params: Promise.resolve({ simulationId }) });
    expect((await readResponse.json()).data.id).toBe(simulationId);

    const { POST } = await import("@/app/api/public/payment-simulations/[simulationId]/confirmation/route");
    const confirmResponse = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ outcome: "CONFIRMED" }),
    }), { params: Promise.resolve({ simulationId }) });
    const body = await confirmResponse.json();

    expect(confirmResponse.status).toBe(200);
    expect(body.data.simulation.status).toBe("CONFIRMED");
    expect(body.data.thankYouMessage).toMatch(/Obrigado/);
  });
});
