import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import "dotenv/config";

const itemId = randomUUID();
const lotId = randomUUID();
const item = { id: itemId, name: "Arroz", category: "Alimentos", unit: "KG", averageUnitValue: "6.00", status: "ACTIVE", accepted: true, priority: true };
const inventory = [{
  item: { id: itemId, name: "Arroz", category: "Alimentos", unit: "KG" }, availableQuantity: "12.000", lotCount: 1,
  lots: [{ id: lotId, availableQuantity: "12.000", receivedOn: "2026-08-01", expiresOn: "2026-08-14", donorName: "Maria", status: "AVAILABLE", alertLevel: "URGENT" }],
}];

async function mockInventory(page: Page) {
  await page.route("**/api/admin/inventory/items", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [item] }) }));
  await page.route("**/api/admin/inventory/lots**", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: inventory[0].lots[0] }) });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: inventory, meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 } }) });
  });
  await page.route("**/api/admin/inventory/distribution-suggestion", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [{ lotId, quantity: "5.000", lotVersion: 1 }] }) }));
  await page.route("**/api/admin/inventory/movements", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { id: randomUUID() } }) }));
}

test.describe("admin inventory", () => {
  test.beforeEach(async ({ page }) => {
    await mockInventory(page);
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(process.env.SEED_ADMIN_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.SEED_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/admin(?:\?.*)?$/);
  });

  test("shows consolidated stock, lot drill-down and textual expiry alert", async ({ page }) => {
    await page.goto("/admin/estoque");
    await expect(page.locator("summary strong", { hasText: "12.000 KG" })).toBeVisible();
    await page.getByText("Arroz").first().click();
    await expect(page.getByText("Vence em até 7 dias")).toBeVisible();
    await expect(page.getByRole("table", { name: "Lotes de Arroz" })).toBeVisible();
  });

  test("registers a lot with average valuation", async ({ page }) => {
    await page.goto("/admin/estoque"); await page.getByRole("button", { name: "Receber lote" }).click();
    const form = page.getByRole("form", { name: "Receber novo lote" });
    await form.getByLabel("Item").selectOption(itemId); await form.getByLabel("Quantidade").fill("10.000"); await form.getByLabel("Data de recebimento").fill("2026-08-08");
    await form.getByRole("button", { name: "Cadastrar lote" }).click();
    await expect(page.getByText("Lote cadastrado com sucesso.")).toBeVisible();
  });

  test("filters 7/30 day alerts and confirms an adjustable suggestion", async ({ page }) => {
    await page.goto("/admin/estoque"); await page.getByRole("button", { name: "Vence em 30 dias" }).click();
    await expect(page.getByRole("button", { name: "Vence em 30 dias" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Registrar saída" }).click();
    const form = page.getByRole("form", { name: "Registrar movimentação de estoque" });
    await form.getByLabel("Item").selectOption(itemId); await form.getByLabel("Quantidade total").fill("5.000"); await form.getByRole("button", { name: "Sugerir lotes por validade" }).click();
    await expect(form.getByText("Sugestão ajustável")).toBeVisible();
    await form.getByLabel("ID do projeto").fill(randomUUID()); await form.getByLabel("Data").fill("2026-08-08");
    await form.getByRole("button", { name: "Confirmar movimentação" }).click();
    await expect(page.getByText("Distribuição registrada.")).toBeVisible();
  });
});
