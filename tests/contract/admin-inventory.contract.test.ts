import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(), listInventoryItems: vi.fn(), createInventoryItem: vi.fn(),
  listConsolidatedInventory: vi.fn(), createInventoryLot: vi.fn(), suggestDistribution: vi.fn(),
  distributeInventory: vi.fn(), discardInventory: vi.fn(), generateInKindTerm: vi.fn(), getServerEnv: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/domains/inventory/inventory-repository", () => ({
  listInventoryItems: mocks.listInventoryItems, createInventoryItem: mocks.createInventoryItem,
  listConsolidatedInventory: mocks.listConsolidatedInventory, createInventoryLot: mocks.createInventoryLot,
}));
vi.mock("@/server/domains/inventory/distribution-service", () => ({ suggestDistribution: mocks.suggestDistribution, distributeInventory: mocks.distributeInventory }));
vi.mock("@/server/domains/inventory/discard-service", () => ({ discardInventory: mocks.discardInventory }));
vi.mock("@/server/documents/in-kind-term", () => ({ generateInKindTerm: mocks.generateInKindTerm }));
vi.mock("@/server/config/env", () => ({ getServerEnv: mocks.getServerEnv }));

const base = "http://localhost:3000/api/admin/inventory";
const userId = randomUUID();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ user: { id: userId, role: "INVENTORY_VOLUNTEER" } });
  mocks.getServerEnv.mockReturnValue({ DOCUMENT_STORAGE_PATH: "/tmp" });
});

describe("admin inventory contract", () => {
  it("lists catalog and creates an item", async () => {
    const item = { id: randomUUID(), name: "Arroz", category: "Alimentos", unit: "KG", averageUnitValue: "6.00", status: "ACTIVE", accepted: true, priority: false };
    mocks.listInventoryItems.mockResolvedValue([item]);
    mocks.createInventoryItem.mockResolvedValue(item);
    const route = await import("@/app/api/admin/inventory/items/route");
    expect((await (await route.GET(new Request(`${base}/items`))).json()).data).toEqual([item]);
    const response = await route.POST(new Request(`${base}/items`, { method: "POST", body: JSON.stringify({ name: "Arroz", category: "Alimentos", unit: "KG", averageUnitValue: "6.00" }) }));
    expect(response.status).toBe(201);
    expect(mocks.createInventoryItem).toHaveBeenCalledWith(userId, expect.objectContaining({ unit: "KG" }));
  });

  it("lists and creates independent lots", async () => {
    const lot = { id: randomUUID(), availableQuantity: "10.000", status: "AVAILABLE" };
    mocks.listConsolidatedInventory.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    mocks.createInventoryLot.mockResolvedValue(lot);
    const route = await import("@/app/api/admin/inventory/lots/route");
    const get = await route.GET(new Request(`${base}/lots?includeLots=true&expiryWindowDays=30`));
    expect(get.status).toBe(200);
    const post = await route.POST(new Request(`${base}/lots`, { method: "POST", body: JSON.stringify({ itemId: randomUUID(), quantity: "10.000", receivedOn: "2026-08-01" }) }));
    expect(post.status).toBe(201);
  });

  it("suggests and commits distribution or discard", async () => {
    const line = { lotId: randomUUID(), quantity: "2.000", lotVersion: 1 };
    mocks.suggestDistribution.mockResolvedValue([line]);
    mocks.distributeInventory.mockResolvedValue({ id: randomUUID(), type: "DISTRIBUTION", lines: [line] });
    mocks.discardInventory.mockResolvedValue({ id: randomUUID(), type: "DISCARD", lines: [line] });
    const suggestion = await import("@/app/api/admin/inventory/distribution-suggestion/route");
    expect((await suggestion.POST(new Request(`${base}/distribution-suggestion`, { method: "POST", body: JSON.stringify({ itemId: randomUUID(), quantity: "2.000" }) }))).status).toBe(200);
    const movements = await import("@/app/api/admin/inventory/movements/route");
    expect((await movements.POST(new Request(`${base}/movements`, { method: "POST", body: JSON.stringify({ type: "DISTRIBUTION" }) }))).status).toBe(201);
    expect((await movements.POST(new Request(`${base}/movements`, { method: "POST", body: JSON.stringify({ type: "DISCARD" }) }))).status).toBe(201);
  });

  it("generates idempotent term metadata for an authorized lot", async () => {
    const lotId = randomUUID();
    mocks.generateInKindTerm.mockResolvedValue({ id: randomUUID(), generatedAt: new Date().toISOString(), downloadUrl: "/api/admin/documents/terms/test.pdf" });
    const route = await import("@/app/api/admin/inventory/lots/[lotId]/term/route");
    const response = await route.POST(new Request(`${base}/lots/${lotId}/term`, { method: "POST" }), { params: Promise.resolve({ lotId }) });
    expect(response.status).toBe(201);
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Request), "IN_KIND_TERM_READ");
  });
});
