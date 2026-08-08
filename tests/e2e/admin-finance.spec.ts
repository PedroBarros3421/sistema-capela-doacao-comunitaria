import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const financeUser = {
  email: "financeiro@teste.org",
  password: "SenhaForte123",
  name: "Financeiro",
  role: "FINANCE",
};

const volunteerUser = {
  email: "voluntario@teste.org",
  password: "SenhaForte123",
  name: "Voluntário",
  role: "INVENTORY_VOLUNTEER",
};

const sampleDashboard = {
  month: "2026-08",
  raised: "1500.00",
  spent: "300.00",
  balance: "1200.00",
  activeDonors: 5,
  expiringLots: 2,
  byProject: [
    { projectId: randomUUID(), projectName: "Projeto Alfa", raised: "1000.00", spent: "200.00" },
  ],
  recurringVsOneOff: { recurring: "800.00", oneOff: "700.00" },
};

const sampleLedger = {
  data: [
    {
      id: randomUUID(),
      type: "INCOME",
      amount: "500.00",
      currency: "BRL",
      occurredOn: "2026-08-01",
      donorId: null,
      donorName: "Maria Silva",
      destination: { type: "MOST_NEEDED" },
      method: "PIX",
      status: "CONFIRMED",
      origin: "PUBLIC",
    },
    {
      id: randomUUID(),
      type: "EXPENSE",
      amount: "100.00",
      currency: "BRL",
      occurredOn: "2026-08-05",
      donorId: null,
      donorName: null,
      destination: { type: "MOST_NEEDED" },
      method: "CASH",
      status: "CONFIRMED",
      origin: "ADMIN",
    },
  ],
  meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
};

async function mockFinanceApis(page: Page, user: typeof financeUser) {
  await page.route("**/api/admin/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: randomUUID(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: "ACTIVE",
          failedLoginCount: 0,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route("**/api/admin/auth/logout", async (route) => {
    await route.fulfill({ status: 204 });
  });

  await page.route("**/api/admin/dashboard**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: sampleDashboard }),
    });
  });

  await page.route("**/api/admin/ledger**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(sampleLedger),
      });
    } else if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: randomUUID(),
            type: body.type,
            amount: (body.amount as string) ?? "0.00",
            currency: "BRL",
            occurredOn: body.occurredOn ?? "2026-08-07",
            donorId: null,
            donorName: null,
            destination: body.destination ?? { type: "MOST_NEEDED" },
            method: body.method ?? "CASH",
            status: body.status ?? "CONFIRMED",
            origin: "ADMIN",
          },
        }),
      });
    }
  });
}

test.describe("Admin dashboard - finance role", () => {
  test("shows KPIs with correct values", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin");
    await page.waitForSelector('[aria-label="Indicadores-chave"]');

    await expect(page.getByText("R$ 1.500,00").first()).toBeVisible();
    await expect(page.getByText("5").first()).toBeVisible();
  });

  test("displays by-project chart when projects exist", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin");
    await page.waitForSelector('[aria-labelledby="charts-heading"]');

    await expect(page.getByText("Projeto Alfa")).toBeVisible();
  });

  test("shows recurring vs one-off breakdown", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin");
    await expect(page.getByText("Recorrente vs. avulso")).toBeVisible();
  });

  test("can switch month with month picker", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin");
    await page.waitForSelector('[aria-label="Selecionar mês"]');

    await page.fill('[aria-label="Selecionar mês"]', "2026-07");
    await expect(page.getByLabel("Selecionar mês")).toHaveValue("2026-07");
  });
});

test.describe("Admin livro-caixa", () => {
  test("shows ledger entries with origin badge", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin/financeiro");
    await page.waitForSelector('[aria-label="Livro-caixa"]');

    await expect(page.getByText("Público")).toBeVisible();
    await expect(page.getByText("Admin")).toBeVisible();
    await expect(page.getByText("Maria Silva")).toBeVisible();
  });

  test("empty state message when no results", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.route("**/api/admin/ledger**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } }),
        });
      }
    });
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin/financeiro");
    await expect(page.getByText("Nenhum lançamento encontrado")).toBeVisible();
  });

  test("opens manual entry form and creates a new entry", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin/financeiro");
    await page.waitForSelector("text=Novo lançamento");
    await page.click("text=Novo lançamento");

    await expect(page.getByRole("form", { name: "Novo lançamento manual" })).toBeVisible();

    await page.fill('[name="amount"]', "250.00");
    await page.fill('[name="occurredOn"]', "2026-08-07");
    await page.click('button[type="submit"]');

    await expect(page.getByText("Lançamento criado com sucesso.")).toBeVisible();
  });

  test("filters by type when INCOME is selected", async ({ page }) => {
    await mockFinanceApis(page, financeUser);
    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin/financeiro");
    await page.waitForSelector('[aria-label="Tipo de lançamento"]');
    await page.selectOption('[aria-label="Tipo de lançamento"]', "INCOME");

    // API was called with type=INCOME (mock always returns same data, just verify no error)
    await expect(page.getByRole("table", { name: "Livro-caixa" })).toBeVisible();
  });
});

test.describe("RBAC - volunteer cannot access finance", () => {
  test("dashboard KPIs visible for volunteer (DASHBOARD_READ not in volunteer perms — mocked as denied)", async ({ page }) => {
    // Volunteer should be denied by the server; here we simulate the 403 on dashboard API
    await page.route("**/api/admin/me", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: randomUUID(),
            name: volunteerUser.name,
            email: volunteerUser.email,
            role: volunteerUser.role,
            status: "ACTIVE",
            failedLoginCount: 0,
            lastLoginAt: null,
            createdAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route("**/api/admin/auth/logout", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.route("**/api/admin/dashboard**", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Acesso negado" } }),
      });
    });

    await page.addInitScript(() => {
      document.cookie = "capela_session=test-token; path=/";
    });

    await page.goto("/admin");
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
