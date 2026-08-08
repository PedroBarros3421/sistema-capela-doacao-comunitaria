"use client";

import type { DashboardProjection } from "@/server/domains/finance/dashboard-service";

type Props = {
  data: DashboardProjection;
};

function formatBRL(value: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    parseFloat(value),
  );
}

function KpiCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <article className="kpi-card" aria-label={label}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {subtitle && <p className="kpi-subtitle">{subtitle}</p>}
    </article>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li className="bar-row">
      <span className="bar-label">{label}</span>
      <div
        className="bar-track"
        role="img"
        aria-label={`${label}: R$ ${value.toFixed(2)}`}
      >
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="bar-value">{formatBRL(value.toFixed(2))}</span>
    </li>
  );
}

export function DashboardCharts({ data }: Props) {
  const maxProjectRaised = Math.max(...data.byProject.map((p) => parseFloat(p.raised)), 0);
  const totalRecurring = parseFloat(data.recurringVsOneOff.recurring);
  const totalOneOff = parseFloat(data.recurringVsOneOff.oneOff);
  const recurringMax = Math.max(totalRecurring, totalOneOff, 1);

  return (
    <section aria-labelledby="charts-heading" className="dashboard-charts">
      <h2 id="charts-heading" className="sr-only">Gráficos do painel</h2>

      <div className="kpi-grid" role="list" aria-label="Indicadores-chave">
        <KpiCard label="Arrecadado" value={formatBRL(data.raised)} />
        <KpiCard label="Despesas" value={formatBRL(data.spent)} />
        <KpiCard label="Saldo" value={formatBRL(data.balance)} />
        <KpiCard label="Doadores ativos" value={String(data.activeDonors)} />
        <KpiCard label="Lotes próx. vencimento" value={String(data.expiringLots)} />
      </div>

      {data.byProject.length > 0 && (
        <section aria-labelledby="by-project-heading" className="chart-section">
          <h3 id="by-project-heading">Arrecadado por projeto</h3>
          <ul className="bar-chart" aria-label="Arrecadado por projeto">
            {data.byProject.map((p) => (
              <BarRow
                key={p.projectId}
                label={p.projectName}
                value={parseFloat(p.raised)}
                max={maxProjectRaised}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recurring-heading" className="chart-section">
        <h3 id="recurring-heading">Recorrente vs. avulso</h3>
        <ul className="bar-chart" aria-label="Recorrente versus avulso">
          <BarRow label="Recorrente" value={totalRecurring} max={recurringMax} />
          <BarRow label="Avulso" value={totalOneOff} max={recurringMax} />
        </ul>
      </section>
    </section>
  );
}
