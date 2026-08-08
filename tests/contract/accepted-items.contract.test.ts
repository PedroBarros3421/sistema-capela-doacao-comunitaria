import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  updateInventoryCatalog: vi.fn(),
  getInventoryItem: vi.fn(),
  updateItemAcceptance: vi.fn(),
  listPublicAcceptedItems: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/domains/inventory/inventory-repository", () => ({
  updateInventoryCatalog: mocks.updateInventoryCatalog,
  getInventoryItem: mocks.getInventoryItem,
}));
vi.mock("@/server/domains/inventory/accepted-items-service", () => ({
  updateItemAcceptance: mocks.updateItemAcceptance,
  listPublicAcceptedItems: mocks.listPublicAcceptedItems,
}));
vi.mock("@/server/db/client", () => ({ db: { $transaction: mocks.transaction } }));

const base = "http://localhost:3000/api";
const userId = randomUUID();
const itemId = randomUUID();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({ user: { id: userId, role: "INVENTORY_VOLUNTEER" } });
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({}));
});

describe("accepted items contract", () => {
  it("updates acceptance and priority through the admin endpoint", async () => {
    const updated = { id: itemId, name: "Arroz", category: "Alimentos", unit: "KG", averageUnitValue: "6.00", status: "ACTIVE", accepted: true, priority: true };
    mocks.getInventoryItem.mockResolvedValue(updated);
    const route = await import("@/app/api/admin/inventory/items/[itemId]/route");
    const response = await route.PATCH(
      new Request(`${base}/admin/inventory/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ accepted: true, priority: true }) }),
      { params: Promise.resolve({ itemId }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(updated);
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Request), "ACCEPTED_ITEM_WRITE");
    expect(mocks.updateItemAcceptance).toHaveBeenCalledWith(userId, itemId, expect.objectContaining({ accepted: true, priority: true }), expect.anything());
  });

  it("lists accepted items publicly without requiring a session", async () => {
    const item = { id: itemId, name: "Arroz", category: "Alimentos", unit: "KG", priority: true };
    mocks.listPublicAcceptedItems.mockResolvedValue([item]);
    const route = await import("@/app/api/public/accepted-items/route");
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([item]);
    expect(mocks.requirePermission).not.toHaveBeenCalled();
  });
});
