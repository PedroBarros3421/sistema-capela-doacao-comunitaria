import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { distributeInventory, suggestDistribution } from "@/server/domains/inventory/distribution-service";
import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createInventoryItem, createInventoryLot, createProject, createUser } from "../helpers/factories";

describe("inventory distribution concurrency", () => {
  let database: DisposableDatabase;
  beforeAll(async () => { database = await createDisposableDatabase(); }, 120_000);
  afterAll(async () => { await database.cleanup(); });

  it("orders lots by expiry, receipt and id and spans multiple lots", async () => {
    const user = await createUser(database.client, { role: "INVENTORY_VOLUNTEER" });
    const project = await createProject(database.client);
    const item = await createInventoryItem(database.client, user.id);
    const later = await createInventoryLot(database.client, item.id, user.id, { quantity: "3.000", expiresOn: "2026-12-20" });
    const sooner = await createInventoryLot(database.client, item.id, user.id, { quantity: "2.000", expiresOn: "2026-12-10" });
    await createInventoryLot(database.client, item.id, user.id, { quantity: "5.000", expiresOn: null });
    const suggestion = await suggestDistribution({ itemId: item.id, quantity: "4.000" }, database.client);
    expect(suggestion.map((line) => line.lotId)).toEqual([sooner.id, later.id]);
    const movement = await distributeInventory(user.id, { type: "DISTRIBUTION", occurredOn: "2026-08-08", projectId: project.id, lines: suggestion.map(({ lotId, quantity }) => ({ lotId, quantity })) }, database.client);
    expect(movement.lines).toHaveLength(2);
  });

  it("serializes concurrent withdrawals and never creates negative stock", async () => {
    const user = await createUser(database.client, { role: "INVENTORY_VOLUNTEER" });
    const project = await createProject(database.client);
    const item = await createInventoryItem(database.client, user.id);
    const lot = await createInventoryLot(database.client, item.id, user.id, { quantity: "10.000", expiresOn: "2026-12-20" });
    const input = { type: "DISTRIBUTION" as const, occurredOn: "2026-08-08", projectId: project.id, lines: [{ lotId: lot.id, quantity: "8.000" }] };
    const results = await Promise.allSettled([distributeInventory(user.id, input, database.client), distributeInventory(user.id, input, database.client)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const stored = await database.client.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(stored.availableQuantity)).toBeGreaterThanOrEqual(0);
    expect(stored.availableQuantity.toFixed(3)).toBe("2.000");
  });
});
