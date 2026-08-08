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
  }

  const candidateIds = new Set<string>();
  if (!identity.cpfCnpj) {
    if (identity.email) {
      const donor = await client.donor.findFirst({ where: { email: identity.email } });
      if (donor) candidateIds.add(donor.id);
    }
    if (identity.phone) {
      const donor = await client.donor.findFirst({ where: { phone: identity.phone } });
      if (donor) candidateIds.add(donor.id);
    }
    if (candidateIds.size === 1) {
      const donor = await client.donor.findUniqueOrThrow({ where: { id: [...candidateIds][0] } });
      return { donor, reviewPending: false };
    }
  }
  const secondaryCandidates = [...candidateIds].map((id) => ({ id }));
  const reviewPending = candidateIds.size > 1;

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
