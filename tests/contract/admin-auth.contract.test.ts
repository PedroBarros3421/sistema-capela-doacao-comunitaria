import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  updateProfile: vi.fn(),
  requireSession: vi.fn(),
  setPasswordFromInvitation: vi.fn(),
  requestPasswordReset: vi.fn(),
  setPasswordFromReset: vi.fn(),
  getServerEnv: vi.fn(),
  dbUserFindUniqueOrThrow: vi.fn(),
}));

vi.mock("@/server/auth/login-service", () => ({ login: mocks.login }));
vi.mock("@/server/auth/account-service", () => ({
  logout: mocks.logout,
  changePassword: mocks.changePassword,
  updateProfile: mocks.updateProfile,
}));
vi.mock("@/server/auth/session", () => ({
  requireSession: mocks.requireSession,
  sessionCookieOptions: (expiresAt: Date) => ({
    name: "capela_session",
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  }),
}));
vi.mock("@/server/auth/password-links", () => ({
  setPasswordFromInvitation: mocks.setPasswordFromInvitation,
  requestPasswordReset: mocks.requestPasswordReset,
  setPasswordFromReset: mocks.setPasswordFromReset,
}));
vi.mock("@/server/config/env", () => ({
  getServerEnv: mocks.getServerEnv,
}));
vi.mock("@/server/db/client", () => ({
  db: { user: { findUniqueOrThrow: mocks.dbUserFindUniqueOrThrow } },
}));

const adminOrigin = "http://localhost:3000";

const sampleUser = {
  id: randomUUID(),
  name: "Admin Teste",
  email: "admin@teste.org",
  role: "GENERAL_ADMIN" as const,
  status: "ACTIVE" as const,
  failedLoginCount: 0,
  lastLoginAt: null,
  createdAt: new Date(),
};

const sampleSession = {
  id: randomUUID(),
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  user: { id: sampleUser.id, name: sampleUser.name, email: sampleUser.email, role: sampleUser.role },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServerEnv.mockReturnValue({
    NODE_ENV: "test",
    SESSION_COOKIE_NAME: "capela_session",
    APP_URL: adminOrigin,
  });
  mocks.requireSession.mockResolvedValue(sampleSession);
  mocks.dbUserFindUniqueOrThrow.mockResolvedValue(sampleUser);
});

describe("POST /api/admin/auth/login", () => {
  it("returns 204 with session cookie on valid credentials", async () => {
    const token = "opaque-token-abc";
    mocks.login.mockResolvedValue({ token, user: sampleUser, expiresAt: sampleSession.expiresAt });

    const { POST } = await import("@/app/api/admin/auth/login/route");
    const response = await POST(new Request(`${adminOrigin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: adminOrigin },
      body: JSON.stringify({ email: "admin@teste.org", password: "SenhaForte1" }),
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("capela_session=");
    expect(mocks.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: "admin@teste.org", password: "SenhaForte1" }),
      expect.any(Object),
    );
  });

  it("returns 401 on invalid credentials", async () => {
    const { AuthenticationError } = await import("@/server/http/errors");
    mocks.login.mockRejectedValue(new AuthenticationError("Credenciais inválidas"));

    const { POST } = await import("@/app/api/admin/auth/login/route");
    const response = await POST(new Request(`${adminOrigin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: adminOrigin },
      body: JSON.stringify({ email: "x@x.com", password: "wrong" }),
    }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 when account is blocked", async () => {
    const { AuthorizationError } = await import("@/server/http/errors");
    mocks.login.mockRejectedValue(new AuthorizationError("Conta bloqueada"));

    const { POST } = await import("@/app/api/admin/auth/login/route");
    const response = await POST(new Request(`${adminOrigin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: adminOrigin },
      body: JSON.stringify({ email: "x@x.com", password: "Senha123" }),
    }));

    expect(response.status).toBe(403);
  });
});

describe("POST /api/admin/auth/logout", () => {
  it("returns 204 and clears the session cookie", async () => {
    mocks.logout.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/admin/auth/logout/route");
    const response = await POST(new Request(`${adminOrigin}/api/admin/auth/logout`, {
      method: "POST",
      headers: {
        cookie: "capela_session=opaque-token",
        origin: adminOrigin,
      },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("capela_session=");
    expect(mocks.logout).toHaveBeenCalled();
  });
});

describe("GET /api/admin/me", () => {
  it("returns current user profile with permissions", async () => {
    const { GET } = await import("@/app/api/admin/me/route");
    const response = await GET(new Request(`${adminOrigin}/api/admin/me`, {
      headers: { cookie: "capela_session=opaque-token", origin: adminOrigin },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(sampleUser.id);
    expect(body.data.role).toBe("GENERAL_ADMIN");
  });

  it("returns 401 without a session", async () => {
    const { AuthenticationError } = await import("@/server/http/errors");
    mocks.requireSession.mockRejectedValue(new AuthenticationError());

    const { GET } = await import("@/app/api/admin/me/route");
    const response = await GET(new Request(`${adminOrigin}/api/admin/me`));
    expect(response.status).toBe(401);
  });
});

describe("PUT /api/admin/me/password", () => {
  it("returns 204 and revokes other sessions on success", async () => {
    mocks.changePassword.mockResolvedValue(undefined);

    const { PUT } = await import("@/app/api/admin/me/password/route");
    const response = await PUT(new Request(`${adminOrigin}/api/admin/me/password`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: "capela_session=token", origin: adminOrigin },
      body: JSON.stringify({ currentPassword: "OldPass1", newPassword: "NewPass1" }),
    }));

    expect(response.status).toBe(204);
    expect(mocks.changePassword).toHaveBeenCalledWith(
      sampleSession.user.id,
      sampleSession.id,
      expect.objectContaining({ currentPassword: "OldPass1", newPassword: "NewPass1" }),
    );
  });

  it("returns 422 when new password is too weak", async () => {
    const { ValidationError } = await import("@/server/http/errors");
    mocks.changePassword.mockRejectedValue(new ValidationError("Senha fraca", { newPassword: ["muito fraca"] }));

    const { PUT } = await import("@/app/api/admin/me/password/route");
    const response = await PUT(new Request(`${adminOrigin}/api/admin/me/password`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: "capela_session=token", origin: adminOrigin },
      body: JSON.stringify({ currentPassword: "OldPass1", newPassword: "weak" }),
    }));

    expect(response.status).toBe(422);
  });
});

describe("PUT /api/public/access/invitation", () => {
  it("sets the password via a valid invitation token", async () => {
    mocks.setPasswordFromInvitation.mockResolvedValue(undefined);

    const { PUT } = await import("@/app/api/public/access/invitation/route");
    const response = await PUT(new Request("http://localhost/api/public/access/invitation", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: "Bearer invite-token-abc" },
      body: JSON.stringify({ newPassword: "NewPass1" }),
    }));

    expect(response.status).toBe(204);
    expect(mocks.setPasswordFromInvitation).toHaveBeenCalledWith(
      "invite-token-abc",
      expect.objectContaining({ newPassword: "NewPass1" }),
    );
  });

  it("returns 401 for an expired or unknown token", async () => {
    const { AuthenticationError } = await import("@/server/http/errors");
    mocks.setPasswordFromInvitation.mockRejectedValue(new AuthenticationError("Link inválido ou expirado"));

    const { PUT } = await import("@/app/api/public/access/invitation/route");
    const response = await PUT(new Request("http://localhost/api/public/access/invitation", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: "Bearer bad-token" },
      body: JSON.stringify({ newPassword: "NewPass1" }),
    }));

    expect(response.status).toBe(401);
  });
});

describe("POST /api/public/access/password-reset-requests", () => {
  it("returns 202 with generic message regardless of email existence", async () => {
    mocks.requestPasswordReset.mockResolvedValue({
      message: "Se o e-mail estiver cadastrado, você receberá as instruções em breve.",
      deliveryStatus: "SIMULATED" as const,
    });

    const { POST } = await import("@/app/api/public/access/password-reset-requests/route");
    const response = await POST(new Request("http://localhost/api/public/access/password-reset-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.deliveryStatus).toBe("SIMULATED");
    expect(body.message).toEqual(expect.any(String));
  });
});

describe("PUT /api/public/access/password-reset", () => {
  it("changes the password via a valid reset token", async () => {
    mocks.setPasswordFromReset.mockResolvedValue(undefined);

    const { PUT } = await import("@/app/api/public/access/password-reset/route");
    const response = await PUT(new Request("http://localhost/api/public/access/password-reset", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: "Bearer reset-token-xyz" },
      body: JSON.stringify({ newPassword: "NewPass1" }),
    }));

    expect(response.status).toBe(204);
    expect(mocks.setPasswordFromReset).toHaveBeenCalledWith(
      "reset-token-xyz",
      expect.objectContaining({ newPassword: "NewPass1" }),
    );
  });
});
