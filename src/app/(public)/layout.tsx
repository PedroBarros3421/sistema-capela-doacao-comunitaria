import type { ReactNode } from "react";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="public-shell" data-theme="public">{children}</div>;
}
