import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { login } from "@/server/auth/login-service";
import { changePassword, logout } from "@/server/auth/account-service";
import { loadSession } from "@/server/auth/session";
import { generateOpaqueToken, hashSecret } from "@/server/auth/crypto";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createUser } from "../helpers/factories";

const PASSWORD = "SenhaForte123";
const ENV = {
  SESSION_COOKIE_NAME: "capela_session",
  SESSION_TTL_HOURS: 8,
  APP_URL: "http://localhost:3000",
};

describe("admin authentication", () => {
  let db: DisposableDatabase;

  beforeAll(async () => {
    db = await createDisposableDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  beforeEach(async () => {
    await db.client.auditEvent.deleteMany();
    await db.client.session.deleteMany();
    await db.client.loginAttempt.deleteMany();
  });

  describe("login", () => {
    it("returns an opaque token and creates a session for valid credentials", async () => {
      const user = await createUser(db.client, { password: PASSWORD });
      const result = await login(
        { email: user.email, password: PASSWORD },
        { client: db.client, env: ENV },
      );

      expect(result.token).toEqual(expect.any(String));
      expect(result.token.length).toBeGreaterThan(32);
      expect(result.user.id).toBe(user.id);
      expect(result.user.role).toBe("GENERAL_ADMIN");

      const session = await db.client.session.findUnique({
        where: { tokenHash: hashSecret(result.token) },
      });
      expect(session).not.toBeNull();
      expect(session!.revokedAt).toBeNull();
    });

    it("rejects wrong password and records a INVALID_CREDENTIALS attempt", async () => {
      const user = await createUser(db.client, { password: PASSWORD });
      await expect(
        login({ email: user.email, password: "wrong-password" }, { client: db.client, env: ENV }),
      ).rejects.toThrow();

      const attempt = await db.client.loginAttempt.findFirst({
        where: { attemptedEmail: user.email },
      });
      expect(attempt?.result).toBe("INVALID_CREDENTIALS");
    });

    it("blocks the account on the fifth consecutive failure and records BLOCKED", async () => {
      const user = await createUser(db.client, { password: PASSWORD });

      for (let i = 0; i < 5; i++) {
        await login({ email: user.email, password: "wrong" }, { client: db.client, env: ENV }).catch(() => {});
      }

      const updated = await db.client.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.status).toBe("BLOCKED");
      expect(updated.blockedAt).not.toBeNull();

      const lastAttempt = await db.client.loginAttempt.findFirst({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
      });
      expect(lastAttempt?.result).toBe("BLOCKED");
    });

    it("denies login to a blocked user immediately", async () => {
      const user = await createUser(db.client, { status: "BLOCKED", password: PASSWORD });
      await expect(
        login({ email: user.email, password: PASSWORD }, { client: db.client, env: ENV }),
      ).rejects.toThrow();

      const attempt = await db.client.loginAttempt.findFirst({ where: { userId: user.id } });
      expect(attempt?.result).toBe("BLOCKED");
    });

    it("resets the failure counter on successful login", async () => {
      const user = await createUser(db.client, { password: PASSWORD });
      await db.client.user.update({ where: { id: user.id }, data: { failedLoginCount: 3 } });

      await login({ email: user.email, password: PASSWORD }, { client: db.client, env: ENV });

      const updated = await db.client.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.failedLoginCount).toBe(0);
    });

    it("rejects PENDING accounts with a clear error", async () => {
      const user = await createUser(db.client, { status: "PENDING", password: PASSWORD });
      await expect(
        login({ email: user.email, password: PASSWORD }, { client: db.client, env: ENV }),
      ).rejects.toThrow();
    });
  });

  describe("session lifecycle", () => {
    it("loads a valid session from token cookie", async () => {
      const user = await createUser(db.client, { password: PASSWORD });
      const { token, expiresAt } = await login(
        { email: user.email, password: PASSWORD },
        { client: db.client, env: ENV },
      );

      const request = new Request("http://localhost/api/admin/me", {
        headers: { cookie: `${ENV.SESSION_COOKIE_NAME}=${token}` },
      });

      const session = await loadSession(request);
      expect(session).not.toBeNull();
      expect(session!.user.id).toBe(user.id);
      expect(session!.expiresAt.getTime()).toBeCloseTo(expiresAt.getTime(), -3);
    });

    it("returns null for an expired session", async () => {
      const user = await createUser(db.client);
      const token = generateOpaqueToken();
      await db.client.session.create({
        data: {
          userId: user.id,
          tokenHash: hashSecret(token),
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const session = await loadSession(new Request("http://localhost", {
        headers: { cookie: `${ENV.SESSION_COOKIE_NAME}=${token}` },
      }));
      expect(session).toBeNull();
    });

    it("revokes a session on logout", async () => {
      const user = await createUser(db.client, { password: PASSWORD });
      const { token } = await login(
        { email: user.email, password: PASSWORD },
        { client: db.client, env: ENV },
      );
      const session = await db.client.session.findFirstOrThrow({ where: { tokenHash: hashSecret(token) } });

      await logout(session.id, db.client);

      const updated = await db.client.session.findUniqueOrThrow({ where: { id: session.id } });
      expect(updated.revokedAt).not.toBeNull();
    });

    it("revokes all other sessions when changing password", async () => {
      const user = await createUser(db.client, { password: PASSWORD });
      const { token: t1 } = await login(
        { email: user.email, password: PASSWORD },
        { client: db.client, env: ENV },
      );
      const { token: t2 } = await login(
        { email: user.email, password: PASSWORD },
        { client: db.client, env: ENV },
      );
      const session1 = await db.client.session.findFirstOrThrow({ where: { tokenHash: hashSecret(t1) } });

      await changePassword(user.id, session1.id, { currentPassword: PASSWORD, newPassword: "NovaSenha123" }, db.client);

      const sessions = await db.client.session.findMany({ where: { userId: user.id } });
      const revoked = sessions.filter((s) => s.revokedAt !== null);
      expect(revoked.length).toBe(1);
      expect(revoked[0].tokenHash).toBe(hashSecret(t2));
    });
  });
});
