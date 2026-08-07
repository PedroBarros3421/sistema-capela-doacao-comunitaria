import type { Prisma } from "@prisma/client";

import { generateOpaqueToken, hashSecret } from "@/server/auth/crypto";

export async function createDonorAccessLink(
  donorId: string,
  appUrl: string,
  client: Prisma.TransactionClient,
) {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const link = await client.accessLink.create({
    data: {
      purpose: "DONOR_ACCOUNT",
      tokenHash: hashSecret(token),
      donorId,
      expiresAt,
    },
  });
  const url = new URL("/doar/minha-conta", appUrl);
  url.searchParams.set("token", token);
  return { link, url: url.toString() };
}
