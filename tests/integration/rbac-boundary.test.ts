import { describe, expect, it } from "vitest";

import { assertPermission, hasPermission } from "@/server/auth/permissions";
import { AuthorizationError } from "@/server/http/errors";

describe("RBAC boundary", () => {

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

});
