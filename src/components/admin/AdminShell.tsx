import type { ReactNode } from "react";

import type { UserRole } from "@prisma/client";

import { AdminNavigation } from "@/components/admin/AdminNavigation";

type Props = {
  children: ReactNode;
  userRole: UserRole;
  userName: string;
};

export function AdminShell({ children, userRole, userName }: Props) {
  return (
    <div className="admin-shell" data-theme="admin">
      <aside className="admin-shell__sidebar">
        <div className="admin-shell__brand">
          <span>Chapel Admin</span>
        </div>
        <div className="admin-shell__user" aria-label="Usuário atual">
          {userName}
        </div>
        <AdminNavigation userRole={userRole} />
      </aside>
      <div className="admin-shell__content">
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
