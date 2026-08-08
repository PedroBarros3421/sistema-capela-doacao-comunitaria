import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import "dotenv/config";

const donorId = randomUUID();
const reviewId = randomUUID();
const candidateId = randomUUID();
const subscriptionId = randomUUID();

const donorSummary = {
  id: donorId,
  name: "Maria Silva",
  email: "maria@example.org",
  phone: null,
  relationshipType: "RECURRING",
  origin: "PUBLIC",
  reviewStatus: "CLEAR",
};

const donorDetail = {
  ...donorSummary,
  documentMasked: "*********00",
  timeline: [
    { type: "DONATION", id: randomUUID(), occurredOn: "2026-08-01", amount: "50.00", projectName: "Assistência às Famílias" },
  ],
  subscriptions: [
    { id: subscriptionId, amount: "50.00", currency: "BRL", status: "ACTIVE", method: "PIX", nextChargeDate: "2026-09-01", destination: { type: "MOST_NEEDED" } },
  ],
};

const openReview = {
  id: reviewId,
  submittedDonorId: donorId,
  candidateDonorIds: [candidateId],
  reason: "IDENTIFIER_CONFLICT",
  status: "OPEN",
  openedAt: new Date().toISOString(),
};

async function mockAdminDonors(page: Page) {
  await page.route("**/api/admin/donors**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [donorSummary], meta: { total: 1, page: 1, pageSize: 20 } }) }));
  await page.route(`**/api/admin/donors/${donorId}**`, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: donorDetail }) }));
  await page.route("**/api/admin/donor-match-reviews**", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [openReview], meta: { total: 1, page: 1, pageSize: 20 } }) });
    }
    return route.continue();
  });
  await page.route(`**/api/admin/donor-match-reviews/${reviewId}/resolution`, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { id: reviewId, status: "KEEP_SEPARATE" } }) }));
}

test.describe("admin donor management", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminDonors(page);
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(process.env.SEED_ADMIN_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.SEED_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/admin(?:\?.*)?$/);
  });

  test("lists donors and shows the donor timeline and subscriptions", async ({ page }) => {
    await page.goto("/admin/doadores");
    await expect(page.getByText("Maria Silva")).toBeVisible();
    await page.getByRole("link", { name: "Ver histórico" }).click();
    await page.waitForURL(`**/admin/doadores/${donorId}`);
    await expect(page.getByRole("heading", { name: "Maria Silva" })).toBeVisible();
    await expect(page.getByText("Assistência às Famílias")).toBeVisible();
    await expect(page.getByText(/PIX · ACTIVE/)).toBeVisible();
  });

  test("resolves an identity conflict review", async ({ page }) => {
    await page.goto("/admin/doadores/revisoes");
    await expect(page.getByText(donorId)).toBeVisible();
    await page.getByLabel("Nota de resolução").fill("Confirmado como pessoas distintas por telefone.");
    await page.getByRole("button", { name: "Manter separados" }).click();
    await expect(page.getByText(donorId)).toHaveCount(0);
  });
});

test.describe("public donor self-service", () => {
  test("shows the donor's own history and lets them pause a subscription", async ({ page }) => {
    const token = "public-donor-link-token";
    let status: "ACTIVE" | "PAUSED" = "ACTIVE";
    await page.route("**/api/public/account", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { donor: { name: "Maria Silva", email: "maria@example.org", phone: null, documentMasked: "*********00" }, donations: [], subscriptions: [{ ...donorDetail.subscriptions[0], status }] } }) }));
    await page.route(`**/api/public/account/subscriptions/${subscriptionId}`, (route) => {
      status = "PAUSED";
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { ...donorDetail.subscriptions[0], status } }) });
    });

    await page.goto(`/doar/minha-conta?token=${token}`);
    await expect(page.getByRole("heading", { name: "Olá, Maria Silva" })).toBeVisible();
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByRole("button", { name: "Retomar" })).toBeVisible();
  });
});
