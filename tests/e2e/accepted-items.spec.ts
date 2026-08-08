import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import "dotenv/config";

const itemId = randomUUID();
const item = { id: itemId, name: "Arroz", category: "Alimentos", unit: "KG", averageUnitValue: "6.00", status: "ACTIVE", accepted: true, priority: false };

async function mockAdminItems(page: Page) {
  let current = { ...item };
  await page.route("**/api/admin/inventory/items", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [current] }) });
    return route.continue();
  });
  await page.route(`**/api/admin/inventory/items/${itemId}`, async (route) => {
    const patch = route.request().postDataJSON() as Record<string, unknown>;
    current = { ...current, ...patch };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: current }) });
  });
}

test.describe("admin accepted items configuration", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminItems(page);
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(process.env.SEED_ADMIN_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.SEED_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/admin(?:\?.*)?$/);
  });

  test("pauses and prioritizes an item", async ({ page }) => {
    await page.goto("/admin/estoque/itens-aceitos");
    await expect(page.getByRole("button", { name: "Aceito" })).toBeVisible();
    await page.getByRole("button", { name: "Comum" }).click();
    await expect(page.getByRole("button", { name: "Prioritário" })).toBeVisible();
    await page.getByRole("button", { name: "Aceito" }).click();
    await expect(page.getByRole("button", { name: "Pausado" })).toBeVisible();
  });
});

test.describe("public accepted items guidance", () => {
  test("shows accepted items without offering lot registration", async ({ page }) => {
    await page.route("**/api/public/accepted-items", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: itemId, name: "Arroz", category: "Alimentos", unit: "KG", priority: true }] }),
    }));
    await page.route("**/api/public/configuration", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          projects: [],
          volunteerHelp: { label: "Chamar um voluntário", contact: "5585999999999" },
          itemDelivery: { address: "Capela Comunitária", instructions: "Entrega presencial em horário comercial." },
        },
      }),
    }));

    await page.goto("/doar/itens");
    await expect(page.getByText("Arroz")).toBeVisible();
    await expect(page.getByText("Necessidade prioritária")).toBeVisible();
    await expect(page.getByText("Entrega presencial em horário comercial.")).toBeVisible();
    await expect(page.getByLabel(/quantidade|peso|validade/i)).toHaveCount(0);
  });
});
