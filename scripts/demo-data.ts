import "dotenv/config";

const BASE_URL = process.env.APP_URL ?? "http://localhost:3000";

type Json = Record<string, unknown>;

function log(event: string, data: Json = {}) {
  console.log(JSON.stringify({ event, ...data }));
}

async function call(
  method: string,
  path: string,
  options: { body?: Json; cookie?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; data: unknown; setCookie: string | null }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: BASE_URL,
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie");
  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(data)}`);
  }
  return { status: response.status, data, setCookie };
}

function sessionCookie(setCookie: string | null): string {
  if (!setCookie) throw new Error("Login não retornou cookie de sessão");
  return setCookie.split(";")[0]!;
}

async function login(email: string, password: string): Promise<string> {
  const { setCookie } = await call("POST", "/api/admin/auth/login", { body: { email, password } });
  return sessionCookie(setCookie);
}

async function activateInvitation(invitationUrl: string, newPassword: string) {
  const token = new URL(invitationUrl).searchParams.get("token");
  if (!token) throw new Error(`Link de convite sem token: ${invitationUrl}`);
  await call("PUT", "/api/public/access/invitation", {
    body: { newPassword },
    headers: { authorization: `Bearer ${token}` },
  });
}

function cpfCheckDigits(base9: string): string {
  const digit = (length: number, source: string) => {
    const sum = source
      .slice(0, length)
      .split("")
      .reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return String(remainder === 10 ? 0 : remainder);
  };
  const first = digit(9, base9);
  const second = digit(10, `${base9}${first}`);
  return `${base9}${first}${second}`;
}

function cnpjCheckDigits(base12: string): string {
  const digit = (source: string, weights: number[]) => {
    const sum = source.split("").reduce((total, char, index) => total + Number(char) * weights[index]!, 0);
    const remainder = sum % 11;
    return String(remainder < 2 ? 0 : 11 - remainder);
  };
  const first = digit(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(`${base12}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base12}${first}${second}`;
}

function daysFromToday(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function donate(
  cookie: string | undefined,
  input: {
    donationType: "ONE_OFF" | "MONTHLY";
    amount: string;
    method: "PIX" | "CARD";
    destination: { type: "PROJECT"; projectId: string } | { type: "MOST_NEEDED" };
    donor?: { name?: string; email?: string; phone?: string; cpfCnpj?: string };
  },
) {
  const idempotencyKey = crypto.randomUUID();
  const created = await call("POST", "/api/public/payment-simulations", {
    body: input,
    cookie,
    headers: { "idempotency-key": idempotencyKey },
  });
  const simulation = created.data as { data: { id: string } };
  const simulationId = simulation.data.id;
  const confirmationKey = crypto.randomUUID();
  const confirmed = await call("POST", `/api/public/payment-simulations/${simulationId}/confirmation`, {
    body: { outcome: "CONFIRMED" },
    cookie,
    headers: { "idempotency-key": confirmationKey },
  });
  return (confirmed.data as { data: Json }).data;
}

async function main() {
  log("demo.start", { baseUrl: BASE_URL });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "P!ssw0rd";
  const adminCookie = await login(adminEmail, adminPassword);
  log("demo.admin.login.ok");

  // --- Staff users -------------------------------------------------------
  const demoPassword = "Demo!2026";
  const staff = [
    { name: "Maria Financeiro", email: "maria.financeiro@example.com", role: "FINANCE" as const },
    { name: "João Voluntário", email: "joao.voluntario@example.com", role: "INVENTORY_VOLUNTEER" as const },
  ];
  for (const person of staff) {
    try {
      const { data } = await call("POST", "/api/admin/users", { body: person, cookie: adminCookie });
      const invitationUrl = (data as { data: { invitationUrl: string } }).data.invitationUrl;
      await activateInvitation(invitationUrl, demoPassword);
      log("demo.staff.created", { email: person.email });
    } catch (error) {
      log("demo.staff.skip", { email: person.email, reason: (error as Error).message });
    }
  }

  // --- Projects ------------------------------------------------------------
  const { data: projectsBody } = await call("GET", "/api/admin/projects", { cookie: adminCookie });
  const projects = (projectsBody as { data: Array<{ id: string; name: string }> }).data;
  const projectByName = (name: string) => projects.find((p) => p.name === name)?.id;
  const familias = projectByName("Assistência às Famílias")!;
  const manutencao = projectByName("Manutenção da Capela")!;
  const maisNecessario = projectByName("Onde for mais necessário")!;

  // --- Public donations (drive the real confirmation flow) ----------------
  await donate(undefined, {
    donationType: "ONE_OFF",
    amount: "50.00",
    method: "PIX",
    destination: { type: "MOST_NEEDED" },
  });

  await donate(undefined, {
    donationType: "ONE_OFF",
    amount: "120.00",
    method: "CARD",
    destination: { type: "PROJECT", projectId: manutencao },
    donor: { name: "Ana Souza", email: "ana.souza@example.com", phone: "85988887777", cpfCnpj: cpfCheckDigits("111444777") },
  });

  await donate(undefined, {
    donationType: "MONTHLY",
    amount: "80.00",
    method: "PIX",
    destination: { type: "PROJECT", projectId: familias },
    donor: { name: "Roberto Lima", email: "roberto.lima@example.com", phone: "85999995555", cpfCnpj: cpfCheckDigits("987654321") },
  });

  await donate(undefined, {
    donationType: "MONTHLY",
    amount: "200.00",
    method: "CARD",
    destination: { type: "MOST_NEEDED" },
    donor: { name: "Empresa Boa Vontade LTDA", email: "contato@boavontade.example.com", cpfCnpj: cnpjCheckDigits("123456780001") },
  });

  await donate(undefined, {
    donationType: "ONE_OFF",
    amount: "35.00",
    method: "PIX",
    destination: { type: "PROJECT", projectId: maisNecessario },
  });

  // Deliberately overlapping identifiers (email then phone, no document) to open
  // an identity review case, matching how src/server/domains/donors/match-donor.ts flags conflicts.
  await donate(undefined, {
    donationType: "ONE_OFF",
    amount: "25.00",
    method: "PIX",
    destination: { type: "MOST_NEEDED" },
    donor: { name: "Carlos Mendes", email: "carlos.mendes@example.com" },
  });
  await donate(undefined, {
    donationType: "ONE_OFF",
    amount: "25.00",
    method: "PIX",
    destination: { type: "MOST_NEEDED" },
    donor: { name: "Carlos M.", phone: "85977776666" },
  });
  await donate(undefined, {
    donationType: "ONE_OFF",
    amount: "25.00",
    method: "PIX",
    destination: { type: "MOST_NEEDED" },
    donor: { name: "Carlos Mendes Confuso", email: "carlos.mendes@example.com", phone: "85977776666" },
  });
  log("demo.public_donations.ok");

  // --- Manual ledger entries (in-person, spread across recent months) ----
  const manualIncomes = [
    { amount: "300.00", occurredOn: daysFromToday(-58), destination: { type: "PROJECT" as const, projectId: familias }, method: "CASH" as const },
    { amount: "150.00", occurredOn: daysFromToday(-45), destination: { type: "PROJECT" as const, projectId: manutencao }, method: "BOLETO" as const },
    { amount: "500.00", occurredOn: daysFromToday(-30), destination: { type: "MOST_NEEDED" as const }, method: "CASH" as const },
    { amount: "220.00", occurredOn: daysFromToday(-14), destination: { type: "PROJECT" as const, projectId: familias }, method: "CASH" as const },
    { amount: "90.00", occurredOn: daysFromToday(-3), destination: { type: "PROJECT" as const, projectId: maisNecessario }, method: "BOLETO" as const },
  ];
  for (const income of manualIncomes) {
    await call("POST", "/api/admin/ledger", {
      cookie: adminCookie,
      body: { type: "INCOME", amount: income.amount, occurredOn: income.occurredOn, destination: income.destination, method: income.method, status: "CONFIRMED" },
    });
  }
  await call("POST", "/api/admin/ledger", {
    cookie: adminCookie,
    body: { type: "INCOME", amount: "60.00", occurredOn: daysFromToday(-1), destination: { type: "MOST_NEEDED" }, method: "PIX", status: "PENDING" },
  });

  const manualExpenses = [
    { amount: "180.00", occurredOn: daysFromToday(-40), destination: { type: "PROJECT" as const, projectId: manutencao } },
    { amount: "95.00", occurredOn: daysFromToday(-20), destination: { type: "PROJECT" as const, projectId: familias } },
    { amount: "60.00", occurredOn: daysFromToday(-6), destination: { type: "MOST_NEEDED" as const } },
  ];
  for (const expense of manualExpenses) {
    await call("POST", "/api/admin/ledger", {
      cookie: adminCookie,
      body: { type: "EXPENSE", amount: expense.amount, occurredOn: expense.occurredOn, destination: expense.destination, method: "BOLETO", status: "CONFIRMED" },
    });
  }
  log("demo.manual_ledger.ok");

  // --- Inventory: catalog items, lots and movements -----------------------
  const { data: itemsBody } = await call("GET", "/api/admin/inventory/items", { cookie: adminCookie });
  const items = (itemsBody as { data: Array<{ id: string; name: string }> }).data;
  const itemByName = (name: string) => items.find((i) => i.name === name)?.id;

  const arroz = itemByName("Arroz")!;
  const feijao = itemByName("Feijão")!;
  const leite = itemByName("Leite")!;
  const fralda = itemByName("Fralda infantil")!;

  async function receiveLot(itemId: string, quantity: string, receivedOn: string, expiresOn: string | null) {
    const { data } = await call("POST", "/api/admin/inventory/lots", {
      cookie: adminCookie,
      body: { itemId, quantity, receivedOn, expiresOn, valuationSource: "AVERAGE_AT_RECEIPT", acceptExpiredDate: true },
    });
    return (data as { data: { id: string } }).data.id;
  }

  const arrozUrgente = await receiveLot(arroz, "50.000", daysFromToday(-10), daysFromToday(5));
  await receiveLot(arroz, "100.000", daysFromToday(-5), daysFromToday(60));
  await receiveLot(feijao, "30.000", daysFromToday(-8), daysFromToday(20));
  const leiteVencido = await receiveLot(leite, "40.000", daysFromToday(-15), daysFromToday(-3));
  await receiveLot(fralda, "200.000", daysFromToday(-2), null);
  log("demo.inventory.lots.ok");

  await call("POST", "/api/admin/inventory/movements", {
    cookie: adminCookie,
    body: {
      type: "DISTRIBUTION",
      occurredOn: daysFromToday(-1),
      projectId: familias,
      note: "Distribuição semanal de cestas básicas",
      lines: [{ lotId: arrozUrgente, quantity: "20.000" }],
    },
  });

  await call("POST", "/api/admin/inventory/movements", {
    cookie: adminCookie,
    body: {
      type: "DISCARD",
      occurredOn: daysFromToday(0),
      reason: "Lote vencido identificado na conferência semanal",
      lines: [{ lotId: leiteVencido, quantity: "40.000" }],
    },
  });
  log("demo.inventory.movements.ok");

  // --- Public accountability report ---------------------------------------
  await call("POST", "/api/admin/reports/publications", {
    cookie: adminCookie,
    body: { from: daysFromToday(-60), to: daysFromToday(0), generatePdf: true },
  });
  log("demo.report.published");

  // --- Login history: a few failed attempts alongside real successes ------
  for (const email of ["desconhecido@example.com", "outra.pessoa@example.com"]) {
    try {
      await call("POST", "/api/admin/auth/login", { body: { email, password: "senha-errada" } });
    } catch {
      // expected: invalid credentials recorded in login_attempts
    }
  }
  try {
    await call("POST", "/api/admin/auth/login", { body: { email: adminEmail, password: "senha-errada-de-teste" } });
  } catch {
    // expected: one recorded failure against the real admin account, well under the block threshold
  }
  log("demo.login_attempts.ok");

  log("demo.done");
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: "demo.failed", message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
