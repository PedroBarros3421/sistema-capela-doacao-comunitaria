-- DropForeignKey
ALTER TABLE "access_links" DROP CONSTRAINT "access_links_created_by_fkey";

-- DropForeignKey
ALTER TABLE "access_links" DROP CONSTRAINT "access_links_user_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_created_by_fkey";

-- AlterTable
ALTER TABLE "accepted_item_configs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "access_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "donation_receipts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "donors" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "in_kind_donation_terms" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_items" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_lots" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_movement_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_movements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ledger_entries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "login_attempts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_simulations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "recurring_subscriptions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "accepted_item_configs" RENAME CONSTRAINT "accepted_item_configs_item_fkey" TO "accepted_item_configs_item_id_fkey";

-- RenameForeignKey
ALTER TABLE "accepted_item_configs" RENAME CONSTRAINT "accepted_item_configs_user_fkey" TO "accepted_item_configs_updated_by_fkey";

-- RenameForeignKey
ALTER TABLE "in_kind_donation_terms" RENAME CONSTRAINT "in_kind_donation_terms_lot_fkey" TO "in_kind_donation_terms_lot_id_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_lots" RENAME CONSTRAINT "inventory_lots_creator_fkey" TO "inventory_lots_created_by_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_lots" RENAME CONSTRAINT "inventory_lots_donor_fkey" TO "inventory_lots_donor_id_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_lots" RENAME CONSTRAINT "inventory_lots_item_fkey" TO "inventory_lots_item_id_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_movement_lines" RENAME CONSTRAINT "inventory_movement_lines_lot_fkey" TO "inventory_movement_lines_lot_id_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_movement_lines" RENAME CONSTRAINT "inventory_movement_lines_movement_fkey" TO "inventory_movement_lines_movement_id_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_movements" RENAME CONSTRAINT "inventory_movements_creator_fkey" TO "inventory_movements_created_by_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_movements" RENAME CONSTRAINT "inventory_movements_project_fkey" TO "inventory_movements_project_id_fkey";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "in_kind_donation_terms_lot_key" RENAME TO "in_kind_donation_terms_lot_id_key";

-- RenameIndex
ALTER INDEX "inventory_lots_item_status_expiry_idx" RENAME TO "inventory_lots_item_id_status_expires_on_received_on_idx";

-- RenameIndex
ALTER INDEX "inventory_lots_status_expiry_idx" RENAME TO "inventory_lots_status_expires_on_idx";

-- RenameIndex
ALTER INDEX "inventory_movement_lines_lot_idx" RENAME TO "inventory_movement_lines_lot_id_idx";

-- RenameIndex
ALTER INDEX "inventory_movement_lines_movement_lot_key" RENAME TO "inventory_movement_lines_movement_id_lot_id_key";

-- RenameIndex
ALTER INDEX "inventory_movements_date_type_idx" RENAME TO "inventory_movements_occurred_on_type_idx";

-- RenameIndex
ALTER INDEX "inventory_movements_project_date_idx" RENAME TO "inventory_movements_project_id_occurred_on_idx";
