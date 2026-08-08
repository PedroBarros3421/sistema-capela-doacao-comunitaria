import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { matchDonor } from "@/server/domains/donors/match-donor";
import { resolveDonorMatchReview } from "@/server/domains/donors/review-service";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createDonor, createLedgerEntry, createUser } from "../helpers/factories";

describe("donor matching priority and conflicts", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it("matches by document before e-mail or phone", async () => {
    const existing = await createDonor(database.client, { document: "12345678900", email: "old@example.org" });

    const result = await matchDonor(
      { name: "Novo Nome", email: "different@example.org", phone: undefined, cpfCnpj: "12345678900" },
      "ONE_OFF",
      database.client,
    );

    expect(result?.donor.id).toBe(existing.id);
    expect(result?.reviewPending).toBe(false);
  });

  it("matches a single donor by normalized e-mail when no document is given", async () => {
    const existing = await createDonor(database.client, { email: "maria@example.org", document: null });

    const result = await matchDonor(
      { name: "Maria", email: "maria@example.org", phone: undefined, cpfCnpj: undefined },
      "ONE_OFF",
      database.client,
    );

    expect(result?.donor.id).toBe(existing.id);
    expect(result?.reviewPending).toBe(false);
  });

  it("opens a review case when e-mail and phone point to different donors", async () => {
    const byEmail = await createDonor(database.client, { email: "conflict@example.org", phone: null });
    const byPhone = await createDonor(database.client, { email: null, phone: "85999990000" });

    const result = await matchDonor(
      { name: "Ambíguo", email: "conflict@example.org", phone: "85999990000", cpfCnpj: undefined },
      "ONE_OFF",
      database.client,
    );

    expect(result?.reviewPending).toBe(true);
    expect(result?.donor.reviewStatus).toBe("PENDING_REVIEW");

    const review = await database.client.donorMatchReview.findFirst({
      where: { submittedDonorId: result?.donor.id },
    });
    expect(review?.status).toBe("OPEN");
    expect(review?.reason).toBe("IDENTIFIER_CONFLICT");
    expect(new Set(review?.candidateDonorIds)).toEqual(new Set([byEmail.id, byPhone.id]));
  });

  it("merges references to the surviving donor and preserves an audit trail", async () => {
    const provisional = await createDonor(database.client, { reviewStatus: "PENDING_REVIEW" });
    const surviving = await createDonor(database.client);
    const review = await database.client.donorMatchReview.create({
      data: {
        submittedDonorId: provisional.id,
        candidateDonorIds: [surviving.id],
        reason: "IDENTIFIER_CONFLICT",
      },
    });
    const resolver = await createUser(database.client, { name: "Admin", email: "admin@example.org", role: "FINANCE" });
    const entry = await createLedgerEntry(database.client, resolver.id, { donorId: provisional.id });

    const resolved = await resolveDonorMatchReview(
      resolver.id,
      review.id,
      { decision: "MERGE", survivingDonorId: surviving.id, note: "Confirmado com o doador por telefone" },
      database.client,
    );

    expect(resolved.status).toBe("MERGED");
    const updatedEntry = await database.client.ledgerEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(updatedEntry.donorId).toBe(surviving.id);
    const updatedProvisional = await database.client.donor.findUniqueOrThrow({ where: { id: provisional.id } });
    expect(updatedProvisional.mergedIntoId).toBe(surviving.id);
    expect(updatedProvisional.reviewStatus).toBe("CLEAR");
    const auditEvent = await database.client.auditEvent.findFirst({ where: { entityId: review.id } });
    expect(auditEvent?.action).toBe("donor.match_review.resolve");
  });

  it("rejects resolving the same review twice", async () => {
    const provisional = await createDonor(database.client, { reviewStatus: "PENDING_REVIEW" });
    const candidate = await createDonor(database.client);
    const review = await database.client.donorMatchReview.create({
      data: { submittedDonorId: provisional.id, candidateDonorIds: [candidate.id], reason: "IDENTIFIER_CONFLICT" },
    });
    const resolver = await createUser(database.client, { name: "Admin 2", email: "admin2@example.org", role: "FINANCE" });

    await resolveDonorMatchReview(
      resolver.id,
      review.id,
      { decision: "KEEP_SEPARATE", note: "Confirmado como pessoas distintas" },
      database.client,
    );

    await expect(
      resolveDonorMatchReview(
        resolver.id,
        review.id,
        { decision: "KEEP_SEPARATE", note: "Nova tentativa" },
        database.client,
      ),
    ).rejects.toThrow(/já foi resolvida/);
  });
});
