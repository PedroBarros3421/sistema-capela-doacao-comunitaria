import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const projectId = "a14629e3-a5fb-4cf2-a274-656585a12a3a";

async function mockDonationApi(page: Page) {
  let confirmations = 0;
  await page.route("**/api/public/configuration", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          projects: [{ id: projectId, name: "Assistência às Famílias" }],
          volunteerHelp: { label: "Chamar um voluntário", contact: "5585999999999" },
          itemDelivery: { address: "Capela", instructions: "Entrega presencial" },
        },
      }),
    });
  });
  await page.route("**/api/public/payment-simulations", async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "1d6ba9ed-c25c-4f9a-9d20-c13799b1d29b",
          donationType: input.donationType,
          amount: input.amount,
          currency: "BRL",
          method: input.method,
          status: "PENDING",
          destination: input.destination,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          qrCodePayload: input.method === "PIX" ? "PIX-SIMULADO:NAO-PAGAVEL" : null,
          simulationNotice: "Simulação demonstrativa: nenhum pagamento ou cobrança real será realizado.",
        },
      }),
    });
  });
  await page.route("**/api/public/payment-simulations/*/confirmation", async (route) => {
    confirmations += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          simulation: { status: "CONFIRMED" },
          ledgerEntryId: "de2fb026-7d43-4f52-af86-4ff2b640b06f",
          subscriptionId: null,
          receiptId: null,
          accountAccessUrl: null,
          donorReviewPending: false,
          thankYouMessage: "Obrigado por apoiar a missão da capela!",
        },
      }),
    });
  });
  return () => confirmations;
}

test("conclui Pix simulado em três passos e ignora duplo toque", async ({ page }) => {
  const confirmationCount = await mockDonationApi(page);
  await page.goto("/doar/dinheiro");

  await page.getByLabel("Doação única").check();
  await page.getByLabel("Outro valor").fill("50,00");
  await page.getByRole("button", { name: "Continuar para método" }).click();
  await page.getByLabel("Pix simulado").check();
  await page.getByRole("button", { name: "Continuar para destino" }).click();
  await page.getByLabel("Assistência às Famílias").check();

  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations.filter((item) => item.impact === "critical")).toEqual([]);

  await page.getByRole("button", { name: "Confirmar doação simulada" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page).toHaveURL(/\/doar\/obrigado$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Muito obrigado!" })).toBeVisible();
  await expect(page.getByText("nenhuma cobrança real", { exact: false })).toBeVisible();
  expect(confirmationCount()).toBe(1);
});

test("apresenta cartão como simulação antes da confirmação", async ({ page }) => {
  await mockDonationApi(page);
  await page.goto("/doar/dinheiro");
  await page.getByLabel("Doação mensal").check();
  await page.getByLabel("Outro valor").fill("75,00");
  await page.getByRole("button", { name: "Continuar para método" }).click();
  await page.getByLabel("Cartão simulado").check();
  await expect(page.getByText("não solicita dados reais do cartão", { exact: false })).toBeVisible();
});

test("permite tentar novamente quando os projetos não carregam", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/public/configuration", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Falha temporária" } }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          projects: [{ id: projectId, name: "Assistência às Famílias" }],
          volunteerHelp: { label: "Chamar um voluntário", contact: "5585999999999" },
          itemDelivery: { address: "Capela", instructions: "Entrega presencial" },
        },
      }),
    });
  });

  await page.goto("/doar/dinheiro");
  await page.getByRole("button", { name: "Continuar para método" }).click();
  await page.getByRole("button", { name: "Continuar para destino" }).click();

  await expect(page.getByText("Não foi possível carregar os projetos", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Tentar carregar novamente" }).click();
  await expect(page.getByLabel("Assistência às Famílias")).toBeVisible();
  expect(attempts).toBe(2);
});
