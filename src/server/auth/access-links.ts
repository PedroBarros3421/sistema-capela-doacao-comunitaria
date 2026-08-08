import type { Prisma, PrismaClient } from "@prisma/client";

import { generateOpaqueToken, hashSecret } from "@/server/auth/crypto";
import { db } from "@/server/db/client";
import { AuthenticationError } from "@/server/http/errors";

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

export async function findValidDonorAccessLink(token: string, client: PrismaClient = db) {
  const now = new Date();
  return client.accessLink.findFirst({
    where: { tokenHash: hashSecret(token), purpose: "DONOR_ACCOUNT", expiresAt: { gt: now }, revokedAt: null },
    include: { donor: true },
  });
}

export async function revokeDonorAccessLinks(donorId: string, client: PrismaClient = db) {
  return client.accessLink.updateMany({
    where: { donorId, purpose: "DONOR_ACCOUNT", revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function requireDonorAccess(request: Request, client: PrismaClient = db) {
  const token = extractBearerToken(request);
  if (!token) throw new AuthenticationError("Link de acesso inválido ou ausente");
  const link = await findValidDonorAccessLink(token, client);
  if (!link || !link.donor) throw new AuthenticationError("Link de acesso inválido ou expirado");
  return { donorId: link.donor.id, donor: link.donor };
}
