CREATE TABLE "public_report_publications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "category_filter" VARCHAR(80),
  "snapshot" JSONB NOT NULL,
  "generated_pdf_path" TEXT,
  "published_by" UUID NOT NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersedes_id" UUID,
  CONSTRAINT "public_report_publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "public_report_publications_period_check" CHECK ("period_start" <= "period_end"),
  CONSTRAINT "public_report_publications_supersedes_id_key" UNIQUE ("supersedes_id")
);

CREATE INDEX "public_report_publications_published_at_idx" ON "public_report_publications" ("published_at");

ALTER TABLE "public_report_publications" ADD CONSTRAINT "public_report_publications_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public_report_publications" ADD CONSTRAINT "public_report_publications_supersedes_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "public_report_publications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
