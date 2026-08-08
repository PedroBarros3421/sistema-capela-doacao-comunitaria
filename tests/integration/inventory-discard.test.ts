import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discardInventory } from "@/server/domains/inventory/discard-service";
import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createInventoryItem, createInventoryLot, createUser } from "../helpers/factories";

describe("inventory discard", () => {
  let database: DisposableDatabase;
  beforeAll(async () => { database = await createDisposableDatabase(); }, 120_000);
  afterAll(async () => { await database.cleanup(); });

  it("keeps partial discard available and marks a fully discarded remainder", async () => {
    const user = await createUser(database.client, { role: "INVENTORY_VOLUNTEER" });
    const item = await createInventoryItem(database.client, user.id);
    const lot = await createInventoryLot(database.client, item.id, user.id, { quantity: "10.000" });
    await discardInventory(user.id, { type: "DISCARD", occurredOn: "2026-08-08", reason: "Embalagem danificada", lines: [{ lotId: lot.id, quantity: "4.000" }] }, database.client);
    expect((await database.client.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } })).status).toBe("AVAILABLE");
    await discardInventory(user.id, { type: "DISCARD", occurredOn: "2026-08-09", reason: "Impróprio para consumo", lines: [{ lotId: lot.id, quantity: "6.000" }] }, database.client);
    const stored = await database.client.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(stored.status).toBe("DISCARDED");
    expect(stored.availableQuantity.toFixed(3)).toBe("0.000");
    const losses = await database.client.inventoryMovementLine.aggregate({ where: { lotId: lot.id, movement: { type: "DISCARD" } }, _sum: { quantity: true } });
    expect(losses._sum.quantity?.toFixed(3)).toBe("10.000");
    expect(await database.client.auditEvent.count({ where: { action: "inventory.discard.create" } })).toBe(2);
  });
});
