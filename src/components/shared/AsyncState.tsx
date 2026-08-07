import type { ReactNode } from "react";

import { Alert } from "@/components/shared/Alert";

type AsyncStateProps = {
  status: "idle" | "loading" | "empty" | "error" | "success";
  children?: ReactNode;
  emptyMessage?: string;
  errorMessage?: string;
};

export function AsyncState({
  children,
  emptyMessage = "Nenhum resultado encontrado.",
  errorMessage = "Não foi possível carregar os dados.",
  status,
}: AsyncStateProps) {
  if (status === "success") return <>{children}</>;
  if (status === "idle") return null;
  if (status === "loading") {
    return <div className="shared-async-state" role="status" aria-live="polite">Carregando…</div>;
  }
  if (status === "empty") {
    return <div className="shared-async-state" role="status">{emptyMessage}</div>;
  }
  return <Alert variant="error">{errorMessage}</Alert>;
}
