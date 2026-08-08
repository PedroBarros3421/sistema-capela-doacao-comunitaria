import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDonorAccessLink, findValidDonorAccessLink } from "@/server/auth/access-links";
import { getDonorAccount, requestDonorAccountAccess } from "@/server/domains/donors/account-access-service";
import { hashSecret } from "@/server/auth/crypto";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createDonor } from "../helpers/factories";

const APP_URL = "http://localhost:3000";

describe("donor account link ownership, reuse, expiration and revocation", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
  });

  afterAll(async () => {
    await database.cleanup();
  });

  it("scopes the account projection to the link's own donor", async () => {
    const donorA = await createDonor(database.client, { name: "Doadora A" });
    const donorB = await createDonor(database.client, { name: "Doador B" });

    const { url } = await createDonorAccessLink(donorA.id, APP_URL, database.client);
    const token = new URL(url).searchParams.get("token")!;

    const link = await findValidDonorAccessLink(token, database.client);
    expect(link?.donor?.id).toBe(donorA.id);
    expect(link?.donor?.id).not.toBe(donorB.id);

    const account = await getDonorAccount(link!.donor!.id, database.client);
    expect(account?.donor.name).toBe("Doadora A");
  });

  it("keeps a valid link reusable across multiple lookups", async () => {
    const donor = await createDonor(database.client);
    const { url } = await createDonorAccessLink(donor.id, APP_URL, database.client);
    const token = new URL(url).searchParams.get("token")!;

    const first = await findValidDonorAccessLink(token, database.client);
    const second = await findValidDonorAccessLink(token, database.client);
    expect(first?.id).toBe(second?.id);
    expect(second).not.toBeNull();
  });

  it("rejects an expired link", async () => {
    const donor = await createDonor(database.client);
    const token = "expired-token-0123456789abcdef0123456789abcdef";
    await database.client.accessLink.create({
      data: {
        purpose: "DONOR_ACCOUNT",
        tokenHash: hashSecret(token),
        donorId: donor.id,
        expiresAt: new Date(Date.now() + 50),
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    const link = await findValidDonorAccessLink(token, database.client);
    expect(link).toBeNull();
  });

  it("revokes the previous link when a new access request is granted", async () => {
    const donor = await createDonor(database.client, { document: "98765432100", email: "titular@example.org" });

    await requestDonorAccountAccess(
      { identifierType: "CPF_CNPJ", identifier: donor.document!, contact: donor.email! },
      APP_URL,
      database.client,
    );
    await requestDonorAccountAccess(
      { identifierType: "CPF_CNPJ", identifier: donor.document!, contact: donor.email! },
      APP_URL,
      database.client,
    );

    const links = await database.client.accessLink.findMany({
      where: { donorId: donor.id },
      orderBy: { createdAt: "asc" },
    });
    expect(links).toHaveLength(2);
    expect(links[0].revokedAt).not.toBeNull();
    expect(links[1].revokedAt).toBeNull();
  });

  it("never reveals whether the identifier or contact matched a donor", async () => {
    const response = await requestDonorAccountAccess(
      { identifierType: "PIX_REFERENCE", identifier: crypto.randomUUID(), contact: "ninguem@example.org" },
      APP_URL,
      database.client,
    );
    expect(response).toEqual({
      message: "Se os dados informados corresponderem a um cadastro, você receberá as instruções em breve.",
      deliveryStatus: "SIMULATED",
    });
  });
});
