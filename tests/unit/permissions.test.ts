import { describe, expect, it } from "vitest";

import { assertPermission, hasPermission } from "@/server/auth/permissions";

describe("RBAC permission matrix", () => {
  it("grants every permission to a general administrator", () => {
    expect(hasPermission("GENERAL_ADMIN", "USER_MANAGE")).toBe(true);
    expect(hasPermission("GENERAL_ADMIN", "INVENTORY_WRITE")).toBe(true);
    expect(hasPermission("GENERAL_ADMIN", "LEDGER_WRITE")).toBe(true);
  });

  it("keeps finance and inventory scopes separate", () => {
    expect(hasPermission("FINANCE", "LEDGER_WRITE")).toBe(true);
    expect(hasPermission("FINANCE", "INVENTORY_WRITE")).toBe(false);
    expect(hasPermission("INVENTORY_VOLUNTEER", "INVENTORY_WRITE")).toBe(true);
    expect(hasPermission("INVENTORY_VOLUNTEER", "LEDGER_READ")).toBe(false);
  });

  it("throws when direct access lacks permission", () => {
    expect(() => assertPermission("FINANCE", "USER_MANAGE")).toThrow("permissão");
  });
});
