import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { updateOwnedSubscription } from "@/server/domains/donors/subscription-service";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createDonor, createLedgerEntry, createRecurringSubscription, createUser } from "../helpers/factories";

describe("recurring subscription transitions", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it("pauses an active subscription and resumes it", async () => {
    const donor = await createDonor(database.client);
    const subscription = await createRecurringSubscription(database.client, donor.id);

    const paused = await updateOwnedSubscription(donor.id, subscription.id, { action: "PAUSE" }, database.client);
    expect(paused.status).toBe("PAUSED");

    const resumed = await updateOwnedSubscription(donor.id, subscription.id, { action: "RESUME" }, database.client);
    expect(resumed.status).toBe("ACTIVE");
  });

  it("rejects resuming a subscription that is not paused", async () => {
    const donor = await createDonor(database.client);
    const subscription = await createRecurringSubscription(database.client, donor.id, { status: "ACTIVE" });

    await expect(
      updateOwnedSubscription(donor.id, subscription.id, { action: "RESUME" }, database.client),
    ).rejects.toThrow(/pausadas podem ser retomadas/);
  });

  it("cancels a subscription and blocks any further transition", async () => {
    const donor = await createDonor(database.client);
    const subscription = await createRecurringSubscription(database.client, donor.id);

    const cancelled = await updateOwnedSubscription(donor.id, subscription.id, { action: "CANCEL" }, database.client);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.nextChargeDate).toBeNull();

    await expect(
      updateOwnedSubscription(donor.id, subscription.id, { action: "RESUME" }, database.client),
    ).rejects.toThrow(/já está cancelada/);
  });

  it("changes only future charges, leaving historical ledger entries untouched", async () => {
    const donor = await createDonor(database.client);
    const admin = await createUser(database.client);
    const subscription = await createRecurringSubscription(database.client, donor.id, { amount: "50.00" });
    const pastEntry = await createLedgerEntry(database.client, admin.id, { donorId: donor.id, amount: "50.00" });

    const updated = await updateOwnedSubscription(
      donor.id,
      subscription.id,
      { action: "CHANGE_AMOUNT", amount: "75.00" },
      database.client,
    );

    expect(updated.amount).toBe("75.00");
    const untouchedEntry = await database.client.ledgerEntry.findUniqueOrThrow({ where: { id: pastEntry.id } });
    expect(untouchedEntry.amount.toFixed(2)).toBe("50.00");
  });

  it("does not allow acting on another donor's subscription", async () => {
    const owner = await createDonor(database.client);
    const stranger = await createDonor(database.client);
    const subscription = await createRecurringSubscription(database.client, owner.id);

    await expect(
      updateOwnedSubscription(stranger.id, subscription.id, { action: "PAUSE" }, database.client),
    ).rejects.toThrow(/não encontrada/);
  });
});
