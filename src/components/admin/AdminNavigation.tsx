"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SVGProps } from "react";

import type { UserRole } from "@prisma/client";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

const ICONS = {
  dashboard: (
    <Icon>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1" />
    </Icon>
  ),
  finance: (
    <Icon>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.5v9M12.5 7.5c0-1.1-1.1-2-2.5-2s-2.5.8-2.5 1.9c0 2.6 5 1.3 5 3.9 0 1.1-1.1 1.9-2.5 1.9s-2.5-.9-2.5-2" />
    </Icon>
  ),
  inventory: (
    <Icon>
      <path d="M2.5 6.5 10 2.5l7.5 4v7L10 17.5l-7.5-4Z" />
      <path d="M2.5 6.5 10 10.5l7.5-4M10 10.5v7" />
    </Icon>
  ),
  donors: (
    <Icon>
      <path d="M10 17s-6.5-4-6.5-8.5A3.5 3.5 0 0 1 10 6a3.5 3.5 0 0 1 6.5 2.5C16.5 13 10 17 10 17Z" />
    </Icon>
  ),
  reports: (
    <Icon>
      <path d="M3 17.5h14" />
      <rect x="4.5" y="10" width="3" height="6" />
      <rect x="8.5" y="6.5" width="3" height="9.5" />
      <rect x="12.5" y="3" width="3" height="13" />
    </Icon>
  ),
  users: (
    <Icon>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M3.5 17c.8-3.4 3.3-5.5 6.5-5.5s5.7 2.1 6.5 5.5" />
    </Icon>
  ),
  projects: (
    <Icon>
      <path d="M2.5 5.5a1 1 0 0 1 1-1H8l1.5 2h7a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z" />
    </Icon>
  ),
  access: (
    <Icon>
      <circle cx="8" cy="12" r="4" />
      <path d="M11 9.3 16.5 3.8M14.5 6.3l1.8 1.8M12.8 8l1.5 1.5" />
    </Icon>
  ),
  profile: (
    <Icon>
      <circle cx="10" cy="7" r="3.2" />
      <path d="M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M8 17H4.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8" />
      <path d="M13 14l4-4-4-4M17 10H7.5" />
    </Icon>
  ),
} as const;

type IconName = keyof typeof ICONS;

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  requiredRole?: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Painel", href: "/admin", icon: "dashboard" },
  { label: "Financeiro", href: "/admin/financeiro", icon: "finance", requiredRole: ["GENERAL_ADMIN", "FINANCE"] },
  { label: "Estoque", href: "/admin/estoque", icon: "inventory", requiredRole: ["GENERAL_ADMIN", "INVENTORY_VOLUNTEER"] },
  { label: "Doadores", href: "/admin/doadores", icon: "donors", requiredRole: ["GENERAL_ADMIN", "FINANCE"] },
  { label: "Relatórios", href: "/admin/relatorios", icon: "reports", requiredRole: ["GENERAL_ADMIN", "FINANCE"] },
  { label: "Usuários", href: "/admin/usuarios", icon: "users", requiredRole: ["GENERAL_ADMIN"] },
  { label: "Projetos", href: "/admin/projetos", icon: "projects", requiredRole: ["GENERAL_ADMIN"] },
  { label: "Acessos", href: "/admin/acessos", icon: "access", requiredRole: ["GENERAL_ADMIN"] },
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
              <span className="admin-nav__icon" aria-hidden="true">{ICONS[item.icon]}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="admin-nav__footer">
        <Link href="/admin/perfil">
          <span className="admin-nav__icon" aria-hidden="true">{ICONS.profile}</span>
          Meu perfil
        </Link>
        <button type="button" onClick={handleLogout}>
          <span className="admin-nav__icon" aria-hidden="true">{ICONS.logout}</span>
          Sair
        </button>
      </div>
    </nav>
  );
}
