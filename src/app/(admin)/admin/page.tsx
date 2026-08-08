"use client";

import { useEffect, useState } from "react";

import { DashboardCharts } from "@/components/admin/DashboardCharts";
import type { DashboardProjection } from "@/server/domains/finance/dashboard-service";

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardProjection }
  | { status: "error"; message: string };

function currentMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function AdminDashboardPage() {
  const [month, setMonth] = useState<string>(currentMonth());
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    setState({ status: "loading" });
    fetch(`/api/admin/dashboard?month=${month}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json() as { error: { message: string } };
          throw new Error(body.error?.message ?? "Erro ao carregar painel");
        }
        return r.json() as Promise<{ data: DashboardProjection }>;
      })
      .then(({ data }) => setState({ status: "ready", data }))
      .catch((err: Error) => setState({ status: "error", message: err.message }));
  }, [month]);

  return (
    <div className="admin-dashboard-page">
      <header className="page-header">
        <h1>Painel</h1>
        <div className="page-header__controls">
          <label htmlFor="month-picker">Mês</label>
          <input
            id="month-picker"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Selecionar mês"
          />
        </div>
      </header>

      {state.status === "loading" && (
        <p aria-busy="true" aria-live="polite">Carregando indicadores…</p>
      )}

      {state.status === "error" && (
        <p role="alert" className="error-message">{state.message}</p>
      )}

      {state.status === "ready" && (
        <DashboardCharts data={state.data} />
      )}
    </div>
  );
}
