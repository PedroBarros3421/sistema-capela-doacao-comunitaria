import type { DonorRelationshipType, Prisma } from "@prisma/client";

import type { NormalizedDonorIdentity } from "@/server/integrations/payment-simulator";

export type DonorMatchResult = {
  donor: Awaited<ReturnType<Prisma.TransactionClient["donor"]["create"]>>;
  reviewPending: boolean;
};

export async function matchDonor(
  identity: NormalizedDonorIdentity | null,
  relationshipType: DonorRelationshipType,
  client: Prisma.TransactionClient,
): Promise<DonorMatchResult | null> {
  if (!identity) return null;

  if (identity.cpfCnpj) {
    const donor = await client.donor.findFirst({ where: { document: identity.cpfCnpj } });
    if (donor) return { donor, reviewPending: false };
  } else if (identity.email) {
    const donors = await client.donor.findMany({ where: { email: identity.email }, take: 2 });
    if (donors.length === 1) return { donor: donors[0], reviewPending: false };
  } else if (identity.phone) {
    const donors = await client.donor.findMany({ where: { phone: identity.phone }, take: 2 });
    if (donors.length === 1) return { donor: donors[0], reviewPending: false };
  }

  const secondaryCandidates = identity.cpfCnpj
    ? []
    : await client.donor.findMany({
        where: {
          OR: [
            ...(identity.email ? [{ email: identity.email }] : []),
            ...(identity.phone ? [{ phone: identity.phone }] : []),
          ],
        },
        select: { id: true },
        take: 2,
      });
  const reviewPending = new Set(secondaryCandidates.map(({ id }) => id)).size > 1;

  const donor = await client.donor.create({
    data: {
      name: identity.name ?? "Doador identificado",
      email: identity.email,
      phone: identity.phone,
      document: identity.cpfCnpj,
      relationshipType,
      origin: "PUBLIC",
      reviewStatus: reviewPending ? "PENDING_REVIEW" : "CLEAR",
    },
  });

  if (reviewPending) {
    await client.donorMatchReview.create({
      data: {
        submittedDonorId: donor.id,
        candidateDonorIds: [...new Set(secondaryCandidates.map(({ id }) => id))],
        reason: "IDENTIFIER_CONFLICT",
      },
    });
  }

  return { donor, reviewPending };
}
