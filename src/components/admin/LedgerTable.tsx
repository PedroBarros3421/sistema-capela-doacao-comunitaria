"use client";

import type { SerializedLedgerEntry } from "@/server/domains/finance/ledger-repository";

type Props = {
  entries: SerializedLedgerEntry[];
  loading: boolean;
};

const METHOD_LABELS: Record<string, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  CASH: "Dinheiro",
  BOLETO: "Boleto",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
};

const TYPE_LABELS: Record<string, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saída",
};

function formatBRL(value: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    parseFloat(value),
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function LedgerTable({ entries, loading }: Props) {
  if (loading) {
    return <p aria-busy="true" aria-live="polite">Carregando lançamentos…</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="empty-state" role="status">
        Nenhum lançamento encontrado para os filtros selecionados.
      </p>
    );
  }

  return (
    <div className="table-scroll" style={{ overflowX: "auto" }}>
      <table className="ledger-table" aria-label="Livro-caixa">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Tipo</th>
            <th scope="col">Valor</th>
            <th scope="col">Método</th>
            <th scope="col">Status</th>
            <th scope="col">Origem</th>
            <th scope="col">Doador</th>
            <th scope="col">Destino</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDate(entry.occurredOn)}</td>
              <td>
                <span
                  className={`type-badge type-badge--${entry.type.toLowerCase()}`}
                  aria-label={TYPE_LABELS[entry.type] ?? entry.type}
                >
                  {TYPE_LABELS[entry.type] ?? entry.type}
                </span>
              </td>
              <td className={entry.type === "INCOME" ? "amount--positive" : "amount--negative"}>
                {entry.type === "EXPENSE" ? "−" : "+"}{formatBRL(entry.amount)}
              </td>
              <td>{METHOD_LABELS[entry.method] ?? entry.method}</td>
              <td>{STATUS_LABELS[entry.status] ?? entry.status}</td>
              <td>
                <span
                  className={`origin-badge origin-badge--${entry.origin.toLowerCase()}`}
                  aria-label={entry.origin === "PUBLIC" ? "Público" : "Admin"}
                >
                  {entry.origin === "PUBLIC" ? "Público" : "Admin"}
                </span>
              </td>
              <td>{entry.donorName ?? <span aria-label="Anônimo">—</span>}</td>
              <td>
                {entry.destination.type === "PROJECT"
                  ? `Projeto`
                  : "Geral"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
