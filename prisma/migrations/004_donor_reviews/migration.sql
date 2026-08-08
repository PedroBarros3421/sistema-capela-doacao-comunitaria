CREATE TYPE "DonorMatchReviewReason" AS ENUM ('IDENTIFIER_CONFLICT', 'POSSIBLE_DUPLICATE');
CREATE TYPE "DonorMatchReviewStatus" AS ENUM ('OPEN', 'KEEP_SEPARATE', 'MERGED');

ALTER TABLE "donors" ADD COLUMN "merged_into_id" UUID;

CREATE TABLE "donor_match_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submitted_donor_id" UUID NOT NULL,
  "candidate_donor_ids" UUID[] NOT NULL,
  "reason" "DonorMatchReviewReason" NOT NULL,
  "status" "DonorMatchReviewStatus" NOT NULL DEFAULT 'OPEN',
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "resolved_by" UUID,
  "resolution_note" TEXT,
  CONSTRAINT "donor_match_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "donor_match_reviews_candidates_check" CHECK (array_length("candidate_donor_ids", 1) >= 1),
  CONSTRAINT "donor_match_reviews_resolution_check" CHECK (
    ("status" = 'OPEN' AND "resolved_at" IS NULL AND "resolved_by" IS NULL AND "resolution_note" IS NULL)
    OR ("status" != 'OPEN' AND "resolved_at" IS NOT NULL AND "resolved_by" IS NOT NULL AND "resolution_note" IS NOT NULL)
  )
);

CREATE INDEX "donor_match_reviews_status_opened_idx" ON "donor_match_reviews" ("status", "opened_at");

ALTER TABLE "donors" ADD CONSTRAINT "donors_merged_into_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donor_match_reviews" ADD CONSTRAINT "donor_match_reviews_submitted_donor_fkey" FOREIGN KEY ("submitted_donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donor_match_reviews" ADD CONSTRAINT "donor_match_reviews_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
