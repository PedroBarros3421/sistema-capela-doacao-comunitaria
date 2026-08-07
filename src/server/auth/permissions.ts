import type { UserRole } from "@prisma/client";

import { AuthorizationError } from "@/server/http/errors";

export const permissions = [
  "ADMIN_ACCESS",
  "DASHBOARD_READ",
  "LEDGER_READ",
  "LEDGER_WRITE",
  "DONOR_READ",
  "DONOR_WRITE",
  "RECEIPT_READ",
  "INVENTORY_READ",
  "INVENTORY_WRITE",
  "IN_KIND_TERM_READ",
  "ACCEPTED_ITEM_WRITE",
  "REPORT_READ",
  "REPORT_PUBLISH",
  "USER_MANAGE",
  "PROJECT_MANAGE",
  "LOGIN_ATTEMPT_READ",
] as const;

export type Permission = (typeof permissions)[number];

const generalAdminPermissions = new Set<Permission>(permissions);

export const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  GENERAL_ADMIN: generalAdminPermissions,
  FINANCE: new Set([
    "ADMIN_ACCESS",
    "DASHBOARD_READ",
    "LEDGER_READ",
    "LEDGER_WRITE",
    "DONOR_READ",
    "DONOR_WRITE",
    "RECEIPT_READ",
    "REPORT_READ",
  ]),
  INVENTORY_VOLUNTEER: new Set([
    "ADMIN_ACCESS",
    "INVENTORY_READ",
    "INVENTORY_WRITE",
    "IN_KIND_TERM_READ",
    "ACCEPTED_ITEM_WRITE",
  ]),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) throw new AuthorizationError();
}
