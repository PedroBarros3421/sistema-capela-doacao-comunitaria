import type { ReactNode } from "react";

import type { UserRole } from "@prisma/client";

import { AdminNavigation } from "@/components/admin/AdminNavigation";

type Props = {
  children: ReactNode;
  userRole: UserRole;
  userName: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  GENERAL_ADMIN: "Administrador geral",
  FINANCE: "Financeiro",
  INVENTORY_VOLUNTEER: "Voluntário de estoque",
};

export function AdminShell({ children, userRole, userName }: Props) {
  return (
    <div className="admin-shell" data-theme="admin">
      <aside className="admin-shell__sidebar">
        <div className="admin-shell__brand">
          <span className="admin-shell__brand-mark" aria-hidden="true">C</span>
          <span className="admin-shell__brand-copy">
            <strong>Capela Comunitária</strong>
            <small>Painel administrativo</small>
          </span>
        </div>
        <div className="admin-shell__user" aria-label="Usuário atual">
          <span className="admin-shell__avatar" aria-hidden="true">
            {userName.trim().charAt(0).toUpperCase()}
          </span>
          <span>
            <strong>{userName}</strong>
            <small>{ROLE_LABELS[userRole]}</small>
          </span>
        </div>
        <AdminNavigation userRole={userRole} />
      </aside>
      <div className="admin-shell__content">
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
