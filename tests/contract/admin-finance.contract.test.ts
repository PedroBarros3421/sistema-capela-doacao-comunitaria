import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getDashboard: vi.fn(),
  listLedgerEntries: vi.fn(),
  createManualLedgerEntry: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/server/domains/finance/dashboard-service", () => ({
  getDashboard: mocks.getDashboard,
}));

vi.mock("@/server/domains/finance/ledger-repository", () => ({
  listLedgerEntries: mocks.listLedgerEntries,
}));

vi.mock("@/server/domains/finance/manual-ledger-service", () => ({
  createManualLedgerEntry: mocks.createManualLedgerEntry,
}));

const base = "http://localhost:3000";

const sampleSession = {
  id: randomUUID(),
  expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
  user: { id: randomUUID(), name: "Admin", email: "admin@test.org", role: "GENERAL_ADMIN" as const },
};

const sampleDashboard = {
  month: "2026-08",
  raised: "500.00",
  spent: "100.00",
  balance: "400.00",
  activeDonors: 3,
  expiringLots: 0,
  byProject: [],
  recurringVsOneOff: { recurring: "200.00", oneOff: "300.00" },
};

const sampleEntry = {
  id: randomUUID(),
  type: "INCOME" as const,
  amount: "150.00",
  currency: "BRL",
  occurredOn: "2026-08-01",
  donorId: null,
  donorName: null,
  destination: { type: "MOST_NEEDED" as const },
  method: "PIX",
  status: "CONFIRMED" as const,
  origin: "ADMIN",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(sampleSession);
});

describe("GET /api/admin/dashboard", () => {
  it("returns 200 with dashboard KPIs for authorized user", async () => {
    mocks.getDashboard.mockResolvedValue(sampleDashboard);

    const { GET } = await import("@/app/api/admin/dashboard/route");
    const response = await GET(new Request(`${base}/api/admin/dashboard?month=2026-08`));
    const body = await response.json() as { data: typeof sampleDashboard };

    expect(response.status).toBe(200);
    expect(body.data.month).toBe("2026-08");
    expect(body.data.raised).toBe("500.00");
    expect(body.data.activeDonors).toBe(3);
    expect(mocks.getDashboard).toHaveBeenCalledWith("2026-08");
  });

  it("returns 401 when session is missing", async () => {
    const { AuthenticationError } = await import("@/server/http/errors");
    mocks.requirePermission.mockRejectedValue(new AuthenticationError());

    const { GET } = await import("@/app/api/admin/dashboard/route");
    const response = await GET(new Request(`${base}/api/admin/dashboard`));
    expect(response.status).toBe(401);
  });

  it("returns 403 when role lacks DASHBOARD_READ", async () => {
    const { AuthorizationError } = await import("@/server/http/errors");
    mocks.requirePermission.mockRejectedValue(new AuthorizationError());

    const { GET } = await import("@/app/api/admin/dashboard/route");
    const response = await GET(new Request(`${base}/api/admin/dashboard`));
    expect(response.status).toBe(403);
  });
});

describe("GET /api/admin/ledger", () => {
  it("returns 200 with paginated ledger entries", async () => {
    mocks.listLedgerEntries.mockResolvedValue({
      items: [sampleEntry],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const { GET } = await import("@/app/api/admin/ledger/route");
    const response = await GET(new Request(`${base}/api/admin/ledger`));
    const body = await response.json() as { data: typeof sampleEntry[]; meta: { total: number } };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].amount).toBe("150.00");
    expect(body.meta.total).toBe(1);
  });

  it("passes filter params to repository", async () => {
    mocks.listLedgerEntries.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    const { GET } = await import("@/app/api/admin/ledger/route");
    await GET(new Request(`${base}/api/admin/ledger?from=2026-08-01&to=2026-08-31&type=INCOME`));

    expect(mocks.listLedgerEntries).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-08-01", to: "2026-08-31", type: "INCOME" }),
      expect.any(Object),
    );
  });

  it("returns 403 when role lacks LEDGER_READ", async () => {
    const { AuthorizationError } = await import("@/server/http/errors");
    mocks.requirePermission.mockRejectedValue(new AuthorizationError());

    const { GET } = await import("@/app/api/admin/ledger/route");
    const response = await GET(new Request(`${base}/api/admin/ledger`));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/admin/ledger", () => {
  it("returns 201 with created entry for finance role", async () => {
    mocks.createManualLedgerEntry.mockResolvedValue(sampleEntry);

    const { POST } = await import("@/app/api/admin/ledger/route");
    const response = await POST(
      new Request(`${base}/api/admin/ledger`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "INCOME",
          amount: "150.00",
          occurredOn: "2026-08-01",
          destination: { type: "MOST_NEEDED" },
          method: "PIX",
          status: "CONFIRMED",
        }),
      }),
    );
    const body = await response.json() as { data: typeof sampleEntry };

    expect(response.status).toBe(201);
    expect(body.data.id).toBe(sampleEntry.id);
    expect(mocks.createManualLedgerEntry).toHaveBeenCalledWith(
      sampleSession.user.id,
      expect.objectContaining({ type: "INCOME", amount: "150.00" }),
    );
  });

  it("returns 403 when role lacks LEDGER_WRITE (volunteer)", async () => {
    const { AuthorizationError } = await import("@/server/http/errors");
    mocks.requirePermission.mockRejectedValue(new AuthorizationError());

    const { POST } = await import("@/app/api/admin/ledger/route");
    const response = await POST(
      new Request(`${base}/api/admin/ledger`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 422 on invalid input", async () => {
    const { ValidationError } = await import("@/server/http/errors");
    mocks.createManualLedgerEntry.mockRejectedValue(
      new ValidationError("Dados inválidos", { amount: ["Valor obrigatório"] }),
    );

    const { POST } = await import("@/app/api/admin/ledger/route");
    const response = await POST(
      new Request(`${base}/api/admin/ledger`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "INCOME" }),
      }),
    );
    expect(response.status).toBe(422);
  });
});
