CREATE TYPE "InventoryUnit" AS ENUM ('KG', 'UNIT', 'LITER');
CREATE TYPE "InventoryItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "InventoryLotStatus" AS ENUM ('AVAILABLE', 'EXHAUSTED', 'DISCARDED');
CREATE TYPE "InventoryValuationSource" AS ENUM ('MANUAL', 'AVERAGE_AT_RECEIPT');
CREATE TYPE "InventoryMovementType" AS ENUM ('DISTRIBUTION', 'DISCARD');

CREATE TABLE "inventory_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "unit" "InventoryUnit" NOT NULL,
  "average_unit_value" DECIMAL(14,2) NOT NULL,
  "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_items_average_value_check" CHECK ("average_unit_value" >= 0)
);

CREATE TABLE "accepted_item_configs" (
  "item_id" UUID NOT NULL,
  "accepted" BOOLEAN NOT NULL DEFAULT TRUE,
  "priority" BOOLEAN NOT NULL DEFAULT FALSE,
  "updated_by" UUID NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accepted_item_configs_pkey" PRIMARY KEY ("item_id"),
  CONSTRAINT "accepted_item_configs_priority_check" CHECK ("accepted" OR NOT "priority")
);

CREATE TABLE "inventory_lots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "item_id" UUID NOT NULL,
  "received_quantity" DECIMAL(14,3) NOT NULL,
  "available_quantity" DECIMAL(14,3) NOT NULL,
  "received_on" DATE NOT NULL,
  "expires_on" DATE,
  "donor_id" UUID,
  "donor_name_snapshot" VARCHAR(160),
  "estimated_value" DECIMAL(14,2) NOT NULL,
  "valuation_source" "InventoryValuationSource" NOT NULL,
  "unit_value_snapshot" DECIMAL(14,2),
  "status" "InventoryLotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_lots_quantity_check" CHECK ("received_quantity" > 0 AND "available_quantity" >= 0 AND "available_quantity" <= "received_quantity"),
  CONSTRAINT "inventory_lots_value_check" CHECK ("estimated_value" >= 0),
  CONSTRAINT "inventory_lots_valuation_check" CHECK (("valuation_source" = 'MANUAL' AND "unit_value_snapshot" IS NULL) OR ("valuation_source" = 'AVERAGE_AT_RECEIPT' AND "unit_value_snapshot" IS NOT NULL)),
  CONSTRAINT "inventory_lots_status_check" CHECK (("status" = 'AVAILABLE' AND "available_quantity" > 0) OR ("status" IN ('EXHAUSTED', 'DISCARDED') AND "available_quantity" = 0))
);

CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "InventoryMovementType" NOT NULL,
  "occurred_on" DATE NOT NULL,
  "project_id" UUID,
  "reason" TEXT,
  "note" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_movements_context_check" CHECK (("type" = 'DISTRIBUTION' AND "project_id" IS NOT NULL AND "reason" IS NULL) OR ("type" = 'DISCARD' AND "project_id" IS NULL AND LENGTH(TRIM("reason")) > 0))
);

CREATE TABLE "inventory_movement_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "movement_id" UUID NOT NULL,
  "lot_id" UUID NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "lot_version" INTEGER NOT NULL,
  CONSTRAINT "inventory_movement_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_movement_lines_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "in_kind_donation_terms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lot_id" UUID NOT NULL,
  "description_snapshot" TEXT NOT NULL,
  "estimated_value_snapshot" DECIMAL(14,2) NOT NULL,
  "donor_snapshot" JSONB NOT NULL,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "file_path" TEXT NOT NULL,
  "content_sha256" CHAR(64) NOT NULL,
  CONSTRAINT "in_kind_donation_terms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "in_kind_donation_terms_value_check" CHECK ("estimated_value_snapshot" >= 0)
);

CREATE UNIQUE INDEX "inventory_items_name_key" ON "inventory_items" (LOWER("name"));
CREATE INDEX "inventory_items_status_name_idx" ON "inventory_items" ("status", "name");
CREATE INDEX "inventory_lots_item_status_expiry_idx" ON "inventory_lots" ("item_id", "status", "expires_on", "received_on");
CREATE INDEX "inventory_lots_status_expiry_idx" ON "inventory_lots" ("status", "expires_on");
CREATE INDEX "inventory_movements_date_type_idx" ON "inventory_movements" ("occurred_on", "type");
CREATE INDEX "inventory_movements_project_date_idx" ON "inventory_movements" ("project_id", "occurred_on");
CREATE UNIQUE INDEX "inventory_movement_lines_movement_lot_key" ON "inventory_movement_lines" ("movement_id", "lot_id");
CREATE INDEX "inventory_movement_lines_lot_idx" ON "inventory_movement_lines" ("lot_id");
CREATE UNIQUE INDEX "in_kind_donation_terms_lot_key" ON "in_kind_donation_terms" ("lot_id");

ALTER TABLE "accepted_item_configs" ADD CONSTRAINT "accepted_item_configs_item_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accepted_item_configs" ADD CONSTRAINT "accepted_item_configs_user_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_donor_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_movement_fkey" FOREIGN KEY ("movement_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movement_lines" ADD CONSTRAINT "inventory_movement_lines_lot_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "in_kind_donation_terms" ADD CONSTRAINT "in_kind_donation_terms_lot_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
