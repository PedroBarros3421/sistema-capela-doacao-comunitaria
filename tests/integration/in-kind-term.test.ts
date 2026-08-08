import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateInKindTerm } from "@/server/documents/in-kind-term";
import { createInventoryLot } from "@/server/domains/inventory/inventory-repository";
import { calculateLotValuation } from "@/server/domains/inventory/valuation-service";
import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createInventoryItem, createUser } from "../helpers/factories";

describe("in-kind valuation and term", () => {
  let database: DisposableDatabase;
  beforeAll(async () => { database = await createDisposableDatabase(); }, 120_000);
  afterAll(async () => { await database.cleanup(); });

  it("calculates from average and preserves manual value", () => {
    expect(calculateLotValuation({ quantity: "2.500", averageUnitValue: "8.00" })).toEqual({ estimatedValue: "20.00", valuationSource: "AVERAGE_AT_RECEIPT", unitValueSnapshot: "8.00" });
    expect(calculateLotValuation({ quantity: "2.500", averageUnitValue: "8.00", valuationSource: "MANUAL", estimatedValue: "25.00" })).toEqual({ estimatedValue: "25.00", valuationSource: "MANUAL", unitValueSnapshot: null });
  });

  it("generates one private PDF derived from the lot on retries", async () => {
    const storagePath = await mkdtemp(join(tmpdir(), "capela-term-"));
    const user = await createUser(database.client, { role: "INVENTORY_VOLUNTEER" });
    const item = await createInventoryItem(database.client, user.id, { name: "Cesta básica", averageUnitValue: "80.00" });
    const lot = await createInventoryLot(user.id, { itemId: item.id, quantity: "2.000", receivedOn: "2026-08-08", donorName: "Maria", valuationSource: "MANUAL", estimatedValue: "180.00" }, database.client);
    const first = await generateInKindTerm(lot.id, { client: database.client, storagePath });
    const second = await generateInKindTerm(lot.id, { client: database.client, storagePath });
    expect(second.id).toBe(first.id);
    expect(await database.client.inKindDonationTerm.count({ where: { lotId: lot.id } })).toBe(1);
  });
});
