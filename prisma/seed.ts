import { randomUUID } from "node:crypto";

import { hashPassword } from "../src/server/auth/crypto";
import { getServerEnv } from "../src/server/config/env";
import { db } from "../src/server/db/client";
import { normalizeEmail } from "../src/server/validation/common";

const foundationProjects = [
  "Assistência às Famílias",
  "Manutenção da Capela",
  "Onde for mais necessário",
] as const;

// T061 creates these tables. Keeping the initial catalog here makes the same seed command
// populate it automatically once the inventory migration is present.
const initialCatalog = [
  { name: "Arroz", category: "Alimentos", unit: "KG", averageValue: "6.00", priority: true },
  { name: "Feijão", category: "Alimentos", unit: "KG", averageValue: "9.00", priority: true },
  { name: "Leite", category: "Alimentos", unit: "LITER", averageValue: "6.50", priority: false },
  { name: "Fralda infantil", category: "Higiene", unit: "UNIT", averageValue: "1.20", priority: false },
] as const;

async function seedAdministrator() {
  const env = getServerEnv();
  const email = normalizeEmail(env.SEED_ADMIN_EMAIL);
  const existing = await db.user.findFirst({ where: { email } });
  if (existing) return existing;

  return db.user.create({
    data: {
      name: env.SEED_ADMIN_NAME,
      email,
      role: "GENERAL_ADMIN",
      status: "ACTIVE",
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
    },
  });
}

async function seedProjects() {
  for (const name of foundationProjects) {
    const existing = await db.project.findFirst({ where: { name } });
    if (!existing) await db.project.create({ data: { name, status: "ACTIVE" } });
  }
}

async function seedCatalogWhenAvailable(administratorId: string) {
  const tables = await db.$queryRaw<Array<{ items: string | null; configs: string | null }>>`
    SELECT
      to_regclass('inventory_items')::text AS items,
      to_regclass('accepted_item_configs')::text AS configs
  `;
  if (!tables[0]?.items || !tables[0]?.configs) return;

  for (const item of initialCatalog) {
    const itemId = randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO inventory_items
        (id, name, category, unit, average_unit_value, status, created_at, updated_at)
       SELECT $1::uuid, $2, $3, $4::"InventoryUnit", $5::numeric, 'ACTIVE'::"InventoryItemStatus", NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE LOWER(name) = LOWER($2))`,
      itemId,
      item.name,
      item.category,
      item.unit,
      item.averageValue,
    );
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      "SELECT id FROM inventory_items WHERE LOWER(name) = LOWER($1) LIMIT 1",
      item.name,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO accepted_item_configs (item_id, accepted, priority, updated_by, updated_at)
       VALUES ($1::uuid, TRUE, $2, $3::uuid, NOW())
       ON CONFLICT (item_id) DO NOTHING`,
      rows[0].id,
      item.priority,
      administratorId,
    );
  }
}

async function main() {
  const administrator = await seedAdministrator();
  await seedProjects();
  await seedCatalogWhenAvailable(administrator.id);

  const env = getServerEnv();
  console.log(
    JSON.stringify({
      event: "database.seeded",
      administratorEmail: administrator.email,
      projectCount: foundationProjects.length,
      publicConfiguration: {
        chapelName: env.CHAPEL_NAME,
        contactEmailConfigured: true,
        contactPhoneConfigured: true,
      },
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ event: "database.seed.failed", error: (error as Error).name }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
