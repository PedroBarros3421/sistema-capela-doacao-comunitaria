import { randomUUID } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/client";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createManualLedgerEntry } from "@/server/domains/finance/manual-ledger-service";
import { getDashboard } from "@/server/domains/finance/dashboard-service";
import {
  listLedgerEntries,
  type LedgerFilter,
} from "@/server/domains/finance/ledger-repository";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createUser, createProject } from "../helpers/factories";

describe("finance dashboard integration", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it("computes exact decimal balance from confirmed entries", async () => {
    const user = await createUser(database.client, { role: "FINANCE" });
    const project = await createProject(database.client);

    // Income: 300.50 + 100.00 = 400.50; Expense: 75.25
    await createManualLedgerEntry(user.id, {
      type: "INCOME",
      amount: "300.50",
      occurredOn: "2026-08-05",
      destination: { type: "PROJECT", projectId: project.id },
      method: "PIX",
      status: "CONFIRMED",
    }, database.client);

    await createManualLedgerEntry(user.id, {
      type: "INCOME",
      amount: "100.00",
      occurredOn: "2026-08-10",
      destination: { type: "MOST_NEEDED" },
      method: "CASH",
      status: "CONFIRMED",
    }, database.client);

    await createManualLedgerEntry(user.id, {
      type: "EXPENSE",
      amount: "75.25",
      occurredOn: "2026-08-12",
      destination: { type: "MOST_NEEDED" },
      method: "CASH",
      status: "CONFIRMED",
    }, database.client);

    // Pending entry should NOT be counted
    await createManualLedgerEntry(user.id, {
      type: "INCOME",
      amount: "999.00",
      occurredOn: "2026-08-15",
      destination: { type: "MOST_NEEDED" },
      method: "PIX",
      status: "PENDING",
    }, database.client);

    const dashboard = await getDashboard("2026-08", database.client);

    expect(new Decimal(dashboard.raised)).toEqual(new Decimal("400.50"));
    expect(new Decimal(dashboard.spent)).toEqual(new Decimal("75.25"));
    expect(new Decimal(dashboard.balance)).toEqual(new Decimal("325.25"));
  });

  it("returns paginated ledger with type filter", async () => {
    const user = await createUser(database.client, { role: "FINANCE" });

    await createManualLedgerEntry(user.id, {
      type: "INCOME",
      amount: "50.00",
      occurredOn: "2026-07-01",
      destination: { type: "MOST_NEEDED" },
      method: "PIX",
      status: "CONFIRMED",
    }, database.client);

    await createManualLedgerEntry(user.id, {
      type: "EXPENSE",
      amount: "20.00",
      occurredOn: "2026-07-02",
      destination: { type: "MOST_NEEDED" },
      method: "CASH",
      status: "CONFIRMED",
    }, database.client);

    const incomeFilter: LedgerFilter = {
      from: "2026-07-01",
      to: "2026-07-31",
      type: "INCOME",
    };
    const result = await listLedgerEntries(incomeFilter, { page: 1, pageSize: 20 }, database.client);

    expect(result.items.every((e) => e.type === "INCOME")).toBe(true);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("creates manual admin entry with correct origin and audit trail", async () => {
    const user = await createUser(database.client, { role: "FINANCE" });
    const id = randomUUID();
    void id;

    const entry = await createManualLedgerEntry(user.id, {
      type: "EXPENSE",
      amount: "45.00",
      occurredOn: "2026-08-20",
      destination: { type: "MOST_NEEDED" },
      method: "BOLETO",
      status: "CONFIRMED",
    }, database.client);

    expect(entry.origin).toBe("ADMIN");
    expect(entry.type).toBe("EXPENSE");
    expect(entry.amount).toBe("45.00");

    const audit = await database.client.auditEvent.findFirst({
      where: { entityId: entry.id, action: "ledger.manual_entry.create" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(user.id);
    expect(audit?.outcome).toBe("SUCCESS");
  });

  it("returns by-project breakdown in dashboard", async () => {
    const user = await createUser(database.client, { role: "FINANCE" });
    const project = await createProject(database.client, { name: `Projeto ${randomUUID().slice(0, 8)}` });

    await createManualLedgerEntry(user.id, {
      type: "INCOME",
      amount: "200.00",
      occurredOn: "2026-09-01",
      destination: { type: "PROJECT", projectId: project.id },
      method: "PIX",
      status: "CONFIRMED",
    }, database.client);

    const dashboard = await getDashboard("2026-09", database.client);

    const projectRow = dashboard.byProject.find((p) => p.projectId === project.id);
    expect(projectRow).toBeDefined();
    expect(new Decimal(projectRow!.raised)).toEqual(new Decimal("200.00"));
  });

  it("rejects invalid amount via zod validation", async () => {
    const user = await createUser(database.client, { role: "FINANCE" });

    await expect(
      createManualLedgerEntry(user.id, {
        type: "INCOME",
        amount: "not-a-number",
        occurredOn: "2026-08-01",
        destination: { type: "MOST_NEEDED" },
        method: "PIX",
        status: "CONFIRMED",
      }, database.client),
    ).rejects.toThrow();
  });
});
