import { expect, test, type Page } from "@playwright/test";

const adminUser = {
  email: "admin@teste.org",
  password: "SenhaForte123",
  name: "Admin Teste",
  role: "GENERAL_ADMIN",
};

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

async function mockAuthApi(page: Page, user: typeof adminUser) {
  await page.route("**/api/admin/auth/login", async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };
    if (body.email === user.email && body.password === user.password) {
      await route.fulfill({
        status: 204,
        headers: { "set-cookie": "capela_session=test-token; Path=/; HttpOnly" },
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Credenciais inválidas" } }),
      });
    }
  });

  await page.route("**/api/admin/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "test-id",
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
    await route.fulfill({
      status: 204,
      headers: { "set-cookie": "capela_session=; Path=/; Max-Age=0" },
    });
  });
}

test.describe("admin login page", () => {
  test("displays the login form with email and password fields", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("shows an error message for invalid credentials", async ({ page }) => {
    await page.route("**/api/admin/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Credenciais inválidas" } }),
      });
    });

    await page.goto("/admin/login");
    await page.getByLabel(/e-mail/i).fill("nobody@test.com");
    await page.getByLabel(/senha/i).fill("wrong");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(/inválid/i);
  });

  test("shows a blocked message when account is blocked", async ({ page }) => {
    await page.route("**/api/admin/auth/login", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "FORBIDDEN", message: "Conta bloqueada" } }),
      });
    });

    await page.goto("/admin/login");
    await page.getByLabel(/e-mail/i).fill("blocked@test.com");
    await page.getByLabel(/senha/i).fill("Senha123");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page.getByRole("alert")).toContainText(/bloqueada/i);
  });
});

test.describe("admin navigation by role", () => {
  test("GENERAL_ADMIN sees full menu including user management", async ({ page }) => {
    await mockAuthApi(page, adminUser);
    await page.goto("/admin/login");
    await page.getByLabel(/e-mail/i).fill(adminUser.email);
    await page.getByLabel(/senha/i).fill(adminUser.password);
    await page.getByRole("button", { name: /entrar/i }).click();

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /usuários/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /financeiro/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /estoque/i })).toBeVisible();
  });

  test("FINANCE user does not see user management link", async ({ page }) => {
    await mockAuthApi(page, financeUser);
    await page.goto("/admin/login");
    await page.getByLabel(/e-mail/i).fill(financeUser.email);
    await page.getByLabel(/senha/i).fill(financeUser.password);
    await page.getByRole("button", { name: /entrar/i }).click();

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /financeiro/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /usuários/i })).not.toBeVisible();
  });

  test("INVENTORY_VOLUNTEER does not see finance link", async ({ page }) => {
    await mockAuthApi(page, volunteerUser);
    await page.goto("/admin/login");
    await page.getByLabel(/e-mail/i).fill(volunteerUser.email);
    await page.getByLabel(/senha/i).fill(volunteerUser.password);
    await page.getByRole("button", { name: /entrar/i }).click();

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /estoque/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /financeiro/i })).not.toBeVisible();
  });
});

test.describe("password recovery flow", () => {
  test("displays the reset request form with generic success message", async ({ page }) => {
    await page.route("**/api/public/access/password-reset-requests", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve.",
          deliveryStatus: "SIMULATED",
        }),
      });
    });

    await page.goto("/acesso/redefinir");
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await page.getByLabel(/e-mail/i).fill("qualquer@email.com");
    await page.getByRole("button", { name: /enviar/i }).click();

    await expect(page.getByRole("alert")).toContainText(/instruções/i);
  });

  test("invite page shows new password form and submits successfully", async ({ page }) => {
    await page.route("**/api/public/access/invitation", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto("/acesso/convite?token=test-token");
    await expect(page.getByLabel(/nova senha/i)).toBeVisible();
    await page.getByLabel(/nova senha/i).fill("NovaSenha123");
    await page.getByRole("button", { name: /definir senha|confirmar/i }).click();

    await expect(page.getByRole("alert")).toContainText(/sucesso|senha definida/i);
  });
});

test.describe("unauthenticated redirect", () => {
  test("accessing /admin without session redirects to /admin/login", async ({ page }) => {
    await page.route("**/api/admin/**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Autenticação necessária" } }),
      });
    });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
