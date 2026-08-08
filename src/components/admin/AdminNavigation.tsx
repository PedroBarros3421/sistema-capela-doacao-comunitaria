"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { UserRole } from "@prisma/client";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  requiredRole?: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Painel", href: "/admin", icon: "▦" },
  { label: "Financeiro", href: "/admin/financeiro", icon: "R$", requiredRole: ["GENERAL_ADMIN", "FINANCE"] },
  { label: "Estoque", href: "/admin/estoque", icon: "□", requiredRole: ["GENERAL_ADMIN", "INVENTORY_VOLUNTEER"] },
  { label: "Doadores", href: "/admin/doadores", icon: "♡", requiredRole: ["GENERAL_ADMIN", "FINANCE"] },
  { label: "Relatórios", href: "/admin/relatorios", icon: "≡", requiredRole: ["GENERAL_ADMIN", "FINANCE"] },
  { label: "Usuários", href: "/admin/usuarios", icon: "○", requiredRole: ["GENERAL_ADMIN"] },
  { label: "Projetos", href: "/admin/projetos", icon: "◇", requiredRole: ["GENERAL_ADMIN"] },
  { label: "Acessos", href: "/admin/acessos", icon: "↗", requiredRole: ["GENERAL_ADMIN"] },
];

type Props = {
  userRole: UserRole;
};

export function AdminNavigation({ userRole }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requiredRole || item.requiredRole.includes(userRole),
  );

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <nav className="admin-nav" aria-label="Menu administrativo">
      <ul role="list">
        {visibleItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span className="admin-nav__icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="admin-nav__footer">
        <Link href="/admin/perfil">
          <span className="admin-nav__icon" aria-hidden="true">●</span>
          Meu perfil
        </Link>
        <button type="button" onClick={handleLogout}>
          <span className="admin-nav__icon" aria-hidden="true">←</span>
          Sair
        </button>
      </div>
    </nav>
  );
}
