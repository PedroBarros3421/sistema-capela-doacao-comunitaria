CREATE TYPE "DonorRelationshipType" AS ENUM ('ONE_OFF', 'RECURRING', 'IN_KIND');
CREATE TYPE "RecordOrigin" AS ENUM ('PUBLIC', 'IN_PERSON', 'ADMIN');
CREATE TYPE "DonorReviewStatus" AS ENUM ('CLEAR', 'PENDING_REVIEW');
CREATE TYPE "DonationType" AS ENUM ('ONE_OFF', 'MONTHLY');
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CARD', 'CASH', 'BOLETO');
CREATE TYPE "PaymentSimulationStatus" AS ENUM ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED');
CREATE TYPE "DestinationType" AS ENUM ('PROJECT', 'MOST_NEEDED');
CREATE TYPE "LedgerEntryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING', 'CONFIRMED');
CREATE TYPE "RecurringSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

CREATE TABLE "donors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(254),
  "phone" VARCHAR(20),
  "document" VARCHAR(14),
  "relationship_type" "DonorRelationshipType" NOT NULL,
  "origin" "RecordOrigin" NOT NULL DEFAULT 'PUBLIC',
  "review_status" "DonorReviewStatus" NOT NULL DEFAULT 'CLEAR',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "donors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "donors_document_format_check" CHECK ("document" IS NULL OR "document" ~ '^(\d{11}|\d{14})$')
);

CREATE TABLE "payment_simulations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idempotency_key" UUID NOT NULL,
  "confirmation_key" UUID,
  "donation_type" "DonationType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentSimulationStatus" NOT NULL DEFAULT 'CREATED',
  "destination_type" "DestinationType" NOT NULL,
  "project_id" UUID,
  "submitted_identity" JSONB,
  "donor_id" UUID,
  "ledger_entry_id" UUID,
  "recurring_subscription_id" UUID,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_simulations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_simulations_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_simulations_currency_check" CHECK ("currency" = 'BRL'),
  CONSTRAINT "payment_simulations_destination_check" CHECK (("destination_type" = 'PROJECT' AND "project_id" IS NOT NULL) OR ("destination_type" = 'MOST_NEEDED' AND "project_id" IS NULL))
);

CREATE TABLE "ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "LedgerEntryType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "occurred_on" DATE NOT NULL,
  "donor_id" UUID,
  "destination_type" "DestinationType" NOT NULL,
  "project_id" UUID,
  "method" "PaymentMethod" NOT NULL,
  "status" "LedgerEntryStatus" NOT NULL DEFAULT 'PENDING',
  "origin" "RecordOrigin" NOT NULL,
  "payment_simulation_id" UUID,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMPTZ(6),
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "ledger_entries_currency_check" CHECK ("currency" = 'BRL'),
  CONSTRAINT "ledger_entries_destination_check" CHECK (("destination_type" = 'PROJECT' AND "project_id" IS NOT NULL) OR ("destination_type" = 'MOST_NEEDED' AND "project_id" IS NULL)),
  CONSTRAINT "ledger_entries_origin_check" CHECK (("origin" = 'PUBLIC' AND "payment_simulation_id" IS NOT NULL AND "created_by" IS NULL) OR ("origin" = 'ADMIN' AND "payment_simulation_id" IS NULL AND "created_by" IS NOT NULL)),
  CONSTRAINT "ledger_entries_confirmation_check" CHECK (("status" = 'CONFIRMED' AND "confirmed_at" IS NOT NULL) OR ("status" = 'PENDING' AND "confirmed_at" IS NULL))
);

CREATE TABLE "recurring_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "donor_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "status" "RecurringSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "method" "PaymentMethod" NOT NULL,
  "next_charge_date" DATE,
  "destination_type" "DestinationType" NOT NULL,
  "project_id" UUID,
  "payment_simulation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recurring_subscriptions_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "recurring_subscriptions_currency_check" CHECK ("currency" = 'BRL'),
  CONSTRAINT "recurring_subscriptions_destination_check" CHECK (("destination_type" = 'PROJECT' AND "project_id" IS NOT NULL) OR ("destination_type" = 'MOST_NEEDED' AND "project_id" IS NULL)),
  CONSTRAINT "recurring_subscriptions_active_date_check" CHECK ("status" <> 'ACTIVE' OR "next_charge_date" IS NOT NULL),
  CONSTRAINT "recurring_subscriptions_method_check" CHECK ("method" IN ('PIX', 'CARD'))
);

CREATE TABLE "donation_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ledger_entry_id" UUID NOT NULL,
  "donor_id" UUID NOT NULL,
  "document_snapshot" VARCHAR(14) NOT NULL,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "file_path" TEXT NOT NULL,
  "content_sha256" CHAR(64) NOT NULL,
  CONSTRAINT "donation_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "donation_receipts_document_format_check" CHECK ("document_snapshot" ~ '^(\d{11}|\d{14})$')
);

CREATE UNIQUE INDEX "donors_document_key" ON "donors"("document") WHERE "document" IS NOT NULL;
CREATE INDEX "donors_email_idx" ON "donors"("email");
CREATE INDEX "donors_phone_idx" ON "donors"("phone");
CREATE INDEX "donors_review_status_created_at_idx" ON "donors"("review_status", "created_at");
CREATE UNIQUE INDEX "payment_simulations_idempotency_key_key" ON "payment_simulations"("idempotency_key");
CREATE UNIQUE INDEX "payment_simulations_confirmation_key_key" ON "payment_simulations"("confirmation_key");
CREATE UNIQUE INDEX "payment_simulations_ledger_entry_id_key" ON "payment_simulations"("ledger_entry_id");
CREATE UNIQUE INDEX "payment_simulations_recurring_subscription_id_key" ON "payment_simulations"("recurring_subscription_id");
CREATE INDEX "payment_simulations_status_expires_at_idx" ON "payment_simulations"("status", "expires_at");
CREATE INDEX "payment_simulations_donor_id_created_at_idx" ON "payment_simulations"("donor_id", "created_at");
CREATE UNIQUE INDEX "ledger_entries_payment_simulation_id_key" ON "ledger_entries"("payment_simulation_id");
CREATE INDEX "ledger_entries_occurred_on_type_status_idx" ON "ledger_entries"("occurred_on", "type", "status");
CREATE INDEX "ledger_entries_project_id_occurred_on_idx" ON "ledger_entries"("project_id", "occurred_on");
CREATE INDEX "ledger_entries_donor_id_occurred_on_idx" ON "ledger_entries"("donor_id", "occurred_on");
CREATE UNIQUE INDEX "recurring_subscriptions_payment_simulation_id_key" ON "recurring_subscriptions"("payment_simulation_id");
CREATE INDEX "recurring_subscriptions_donor_id_status_idx" ON "recurring_subscriptions"("donor_id", "status");
CREATE INDEX "recurring_subscriptions_next_charge_date_status_idx" ON "recurring_subscriptions"("next_charge_date", "status");
CREATE UNIQUE INDEX "donation_receipts_ledger_entry_id_key" ON "donation_receipts"("ledger_entry_id");
CREATE INDEX "donation_receipts_donor_id_generated_at_idx" ON "donation_receipts"("donor_id", "generated_at");

ALTER TABLE "access_links" ADD CONSTRAINT "access_links_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_simulations" ADD CONSTRAINT "payment_simulations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_simulations" ADD CONSTRAINT "payment_simulations_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_simulation_id_fkey" FOREIGN KEY ("payment_simulation_id") REFERENCES "payment_simulations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_subscriptions" ADD CONSTRAINT "recurring_subscriptions_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_subscriptions" ADD CONSTRAINT "recurring_subscriptions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_subscriptions" ADD CONSTRAINT "recurring_subscriptions_payment_simulation_id_fkey" FOREIGN KEY ("payment_simulation_id") REFERENCES "payment_simulations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donation_receipts" ADD CONSTRAINT "donation_receipts_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donation_receipts" ADD CONSTRAINT "donation_receipts_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_simulations" ADD CONSTRAINT "payment_simulations_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_simulations" ADD CONSTRAINT "payment_simulations_recurring_subscription_id_fkey" FOREIGN KEY ("recurring_subscription_id") REFERENCES "recurring_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
