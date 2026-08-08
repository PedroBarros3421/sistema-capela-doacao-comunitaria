import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertPermission, hasPermission } from "@/server/auth/permissions";
import { AuthorizationError } from "@/server/http/errors";
import { requirePermission } from "@/server/auth/session";

import { createDisposableDatabase, type DisposableDatabase } from "../helpers/database";
import { createUser } from "../helpers/factories";
import { createAuthenticatedRequest } from "../helpers/auth";

describe("RBAC boundary", () => {
  let db: DisposableDatabase;

  beforeAll(async () => {
    db = await createDisposableDatabase();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe("hasPermission matrix", () => {
    it("grants all permissions to GENERAL_ADMIN", () => {
      expect(hasPermission("GENERAL_ADMIN", "ADMIN_ACCESS")).toBe(true);
      expect(hasPermission("GENERAL_ADMIN", "USER_MANAGE")).toBe(true);
      expect(hasPermission("GENERAL_ADMIN", "LEDGER_WRITE")).toBe(true);
      expect(hasPermission("GENERAL_ADMIN", "INVENTORY_WRITE")).toBe(true);
      expect(hasPermission("GENERAL_ADMIN", "REPORT_PUBLISH")).toBe(true);
    });

    it("grants finance permissions to FINANCE role only", () => {
      expect(hasPermission("FINANCE", "ADMIN_ACCESS")).toBe(true);
      expect(hasPermission("FINANCE", "LEDGER_READ")).toBe(true);
      expect(hasPermission("FINANCE", "LEDGER_WRITE")).toBe(true);
      expect(hasPermission("FINANCE", "DONOR_READ")).toBe(true);

      expect(hasPermission("FINANCE", "USER_MANAGE")).toBe(false);
      expect(hasPermission("FINANCE", "INVENTORY_WRITE")).toBe(false);
      expect(hasPermission("FINANCE", "REPORT_PUBLISH")).toBe(false);
      expect(hasPermission("FINANCE", "PROJECT_MANAGE")).toBe(false);
    });

    it("grants inventory permissions to INVENTORY_VOLUNTEER role only", () => {
      expect(hasPermission("INVENTORY_VOLUNTEER", "ADMIN_ACCESS")).toBe(true);
      expect(hasPermission("INVENTORY_VOLUNTEER", "INVENTORY_READ")).toBe(true);
      expect(hasPermission("INVENTORY_VOLUNTEER", "INVENTORY_WRITE")).toBe(true);
      expect(hasPermission("INVENTORY_VOLUNTEER", "ACCEPTED_ITEM_WRITE")).toBe(true);

      expect(hasPermission("INVENTORY_VOLUNTEER", "LEDGER_READ")).toBe(false);
      expect(hasPermission("INVENTORY_VOLUNTEER", "DONOR_READ")).toBe(false);
      expect(hasPermission("INVENTORY_VOLUNTEER", "REPORT_READ")).toBe(false);
      expect(hasPermission("INVENTORY_VOLUNTEER", "USER_MANAGE")).toBe(false);
    });
  });

  describe("assertPermission", () => {
    it("throws AuthorizationError when permission is missing", () => {
      expect(() => assertPermission("FINANCE", "USER_MANAGE")).toThrow(AuthorizationError);
      expect(() => assertPermission("INVENTORY_VOLUNTEER", "LEDGER_READ")).toThrow(AuthorizationError);
    });

    it("does not throw when permission is present", () => {
      expect(() => assertPermission("FINANCE", "LEDGER_WRITE")).not.toThrow();
      expect(() => assertPermission("GENERAL_ADMIN", "USER_MANAGE")).not.toThrow();
    });
  });

  describe("requirePermission on live sessions", () => {
    it("grants access when the role has the permission", async () => {
      const admin = await createUser(db.client, { role: "GENERAL_ADMIN" });
      const { request } = await createAuthenticatedRequest(db.client, admin.id);

      const session = await requirePermission(request, "USER_MANAGE");
      expect(session.user.id).toBe(admin.id);
    });

    it("denies access when the role lacks the permission", async () => {
      const volunteer = await createUser(db.client, { role: "INVENTORY_VOLUNTEER" });
      const { request } = await createAuthenticatedRequest(db.client, volunteer.id);

      await expect(requirePermission(request, "LEDGER_READ")).rejects.toThrow(AuthorizationError);
    });

    it("denies access to a user whose status is INACTIVE even with a valid token", async () => {
      const user = await createUser(db.client, { status: "INACTIVE" });
      const { request } = await createAuthenticatedRequest(db.client, user.id);

      const session = await import("@/server/auth/session").then((m) => m.loadSession(request));
      expect(session).toBeNull();
    });

    it("denies access to a user whose status becomes BLOCKED after session creation", async () => {
      const user = await createUser(db.client);
      const { request } = await createAuthenticatedRequest(db.client, user.id);

      await db.client.user.update({ where: { id: user.id }, data: { status: "BLOCKED" } });

      const session = await import("@/server/auth/session").then((m) => m.loadSession(request));
      expect(session).toBeNull();
    });
  });
});
