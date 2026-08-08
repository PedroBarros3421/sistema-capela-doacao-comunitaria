"use client";

import { useEffect, useState } from "react";

import { PublicReportChart } from "@/components/donor/PublicReportChart";

type PublicReport = {
  id: string;
  publishedAt: string;
  period: { from: string; to: string };
  totals: { moneyReceived: string; inKindEstimated: string; spent: string };
  byProject: Array<{ projectName: string; moneyReceived: string; spent: string }>;
};

function formatBRL(value: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export default function TransparenciaPage() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; report: PublicReport } | { status: "empty" } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    fetch("/api/public/reports/latest")
      .then(async (response) => {
        if (response.status === 404) return { empty: true } as const;
        const body = await response.json() as { data?: PublicReport; error?: { message: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar a prestação de contas");
        return { empty: false, report: body.data! } as const;
      })
      .then((result) => setState(result.empty ? { status: "empty" } : { status: "ready", report: result.report }))
      .catch((cause: unknown) => setState({ status: "error", message: cause instanceof Error ? cause.message : "Erro de conexão" }));
  }, []);

  return (
    <main className="donor-page">
      <header className="donor-hero">
        <span className="donor-eyebrow">Capela Comunitária</span>
        <h1>Veja onde seu dinheiro vai</h1>
        <p>Números da última prestação de contas publicada, sem dados pessoais.</p>
      </header>

      {state.status === "loading" && <p aria-busy="true">Carregando…</p>}
      {state.status === "error" && <p role="alert" className="error-message">{state.message}</p>}
      {state.status === "empty" && (
        <p className="empty-state" role="status">Ainda não há uma prestação de contas publicada.</p>
      )}

      {state.status === "ready" && (
        <section aria-label="Resumo financeiro" className="public-report">
          <p>
            Período de {formatDate(state.report.period.from)} a {formatDate(state.report.period.to)} · publicado em{" "}
            {formatDate(state.report.publishedAt)}
          </p>

          <div className="kpi-grid" role="list" aria-label="Totais">
            <article className="kpi-card"><p className="kpi-label">Recebido em dinheiro</p><p className="kpi-value">{formatBRL(state.report.totals.moneyReceived)}</p></article>
            <article className="kpi-card"><p className="kpi-label">Bens recebidos</p><p className="kpi-value">{formatBRL(state.report.totals.inKindEstimated)}</p></article>
            <article className="kpi-card"><p className="kpi-label">Gasto no período</p><p className="kpi-value">{formatBRL(state.report.totals.spent)}</p></article>
          </div>

          <PublicReportChart totals={state.report.totals} />

          {state.report.byProject.length > 0 && (
            <table className="report-table">
              <caption>Por projeto</caption>
              <thead><tr><th scope="col">Projeto</th><th scope="col">Recebido</th><th scope="col">Gasto</th></tr></thead>
              <tbody>
                {state.report.byProject.map((project) => (
                  <tr key={project.projectName}><td>{project.projectName}</td><td>{formatBRL(project.moneyReceived)}</td><td>{formatBRL(project.spent)}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <a href="/api/public/reports/latest.pdf">Baixar PDF da prestação de contas</a>
        </section>
      )}
    </main>
  );
}
