type Totals = { moneyReceived: string; inKindEstimated: string; spent: string };

function formatBRL(value: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value));
}

export function PublicReportChart({ totals }: { totals: Totals }) {
  const bars = [
    { label: "Recebido em dinheiro", value: parseFloat(totals.moneyReceived), raw: totals.moneyReceived },
    { label: "Bens recebidos (estimado)", value: parseFloat(totals.inKindEstimated), raw: totals.inKindEstimated },
    { label: "Gasto no período", value: parseFloat(totals.spent), raw: totals.spent },
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <svg
      role="img"
      aria-label={`Dinheiro recebido ${formatBRL(totals.moneyReceived)}, bens recebidos ${formatBRL(totals.inKindEstimated)}, gasto ${formatBRL(totals.spent)}`}
      viewBox="0 0 320 180"
      width="100%"
      height="180"
      className="public-report-chart"
    >
      <title>Resumo financeiro do período publicado</title>
      {bars.map((bar, index) => {
        const barHeight = Math.max(4, (bar.value / max) * 110);
        const x = 20 + index * 100;
        const y = 140 - barHeight;
        return (
          <g key={bar.label}>
            <rect x={x} y={y} width="60" height={barHeight} rx="4" fill="currentColor" />
            <text x={x + 30} y={158} textAnchor="middle" fontSize="11">{bar.label}</text>
            <text x={x + 30} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="bold">{formatBRL(bar.raw)}</text>
          </g>
        );
      })}
    </svg>
  );
}
