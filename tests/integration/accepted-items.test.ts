import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPublicAcceptedItems, updateItemAcceptance } from "@/server/domains/inventory/accepted-items-service";
import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createInventoryItem, createUser } from "../helpers/factories";

describe("accepted items", () => {
  let database: DisposableDatabase;
  beforeAll(async () => { database = await createDisposableDatabase(); }, 120_000);
  afterAll(async () => { await database.cleanup(); });

  it("reflects acceptance and priority immediately for public reads", async () => {
    const user = await createUser(database.client, { role: "INVENTORY_VOLUNTEER" });
    const common = await createInventoryItem(database.client, user.id, { name: "Arroz" });
    const priority = await createInventoryItem(database.client, user.id, { name: "Feijão" });

    await updateItemAcceptance(user.id, priority.id, { priority: true }, database.client);

    const listed = await listPublicAcceptedItems(database.client);
    expect(listed.map((entry) => entry.id)).toEqual([priority.id, common.id]);
    expect(listed[0]).toMatchObject({ id: priority.id, priority: true });
  });

  it("hides a paused item from the public list", async () => {
    const user = await createUser(database.client, { role: "INVENTORY_VOLUNTEER" });
    const item = await createInventoryItem(database.client, user.id, { name: "Cobertor" });

    await updateItemAcceptance(user.id, item.id, { accepted: false }, database.client);

    const listed = await listPublicAcceptedItems(database.client);
    expect(listed.some((entry) => entry.id === item.id)).toBe(false);
  });

  it("forces priority to false when an item is paused", async () => {
    const user = await createUser(database.client, { role: "INVENTORY_VOLUNTEER" });
    const item = await createInventoryItem(database.client, user.id, { name: "Leite" });
    await updateItemAcceptance(user.id, item.id, { priority: true }, database.client);

    await updateItemAcceptance(user.id, item.id, { accepted: false }, database.client);

    const config = await database.client.acceptedItemConfig.findUniqueOrThrow({ where: { itemId: item.id } });
    expect(config.accepted).toBe(false);
    expect(config.priority).toBe(false);
  });
});
