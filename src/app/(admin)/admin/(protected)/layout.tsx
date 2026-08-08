import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { headers } from "next/headers";

import { loadSession } from "@/server/auth/session";
import { AdminShell } from "@/components/admin/AdminShell";

type Props = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: Props) {
  const headersList = await headers();
  const cookieHeader = headersList.get("cookie") ?? "";

  const request = new Request("http://localhost/admin", {
    headers: { cookie: cookieHeader },
  });

  const session = await loadSession(request);
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminShell userRole={session.user.role} userName={session.user.name}>
      {children}
    </AdminShell>
  );
}
