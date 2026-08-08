"use client";

import { useCallback, useEffect, useState } from "react";

import { LedgerForm } from "@/components/admin/LedgerForm";
import { LedgerTable } from "@/components/admin/LedgerTable";
import type { SerializedLedgerEntry } from "@/server/domains/finance/ledger-repository";

type PageMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type PageState =
  | { status: "loading" }
  | { status: "ready"; entries: SerializedLedgerEntry[]; meta: PageMeta }
  | { status: "error"; message: string };

type Filters = {
  from: string;
  to: string;
  type: string;
  status: string;
};

const EMPTY_FILTERS: Filters = { from: "", to: "", type: "", status: "" };

export default function FinanceiroPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [showForm, setShowForm] = useState(false);

  const fetchLedger = useCallback(
    (f: Filters, p: number) => {
      const params = new URLSearchParams({ page: String(p), pageSize: "20" });
      if (f.from) params.set("from", f.from);
      if (f.to) params.set("to", f.to);
      if (f.type) params.set("type", f.type);
      if (f.status) params.set("status", f.status);

      fetch(`/api/admin/ledger?${params.toString()}`)
        .then(async (r) => {
          if (!r.ok) {
            const body = await r.json() as { error: { message: string } };
            throw new Error(body.error?.message ?? "Erro ao carregar lançamentos");
          }
          return r.json() as Promise<{ data: SerializedLedgerEntry[]; meta: PageMeta }>;
        })
        .then(({ data, meta }) => setPageState({ status: "ready", entries: data, meta }))
        .catch((err: Error) => setPageState({ status: "error", message: err.message }));
    },
    [],
  );

  useEffect(() => {
    fetchLedger(filters, page);
  }, [fetchLedger, filters, page]);

  function handleFilterChange(key: keyof Filters, value: string) {
    setPageState({ status: "loading" });
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleReset() {
    setPageState({ status: "loading" });
    setPage(1);
    setFilters(EMPTY_FILTERS);
  }

  return (
    <div className="admin-financeiro-page">
      <header className="page-header">
        <h1>Livro-caixa</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          aria-controls="ledger-form-panel"
        >
          {showForm ? "Cancelar" : "Novo lançamento"}
        </button>
      </header>

      {showForm && (
        <section id="ledger-form-panel" aria-labelledby="form-heading">
          <h2 id="form-heading" className="sr-only">Formulário de novo lançamento</h2>
          <LedgerForm
            onSuccess={() => {
              setShowForm(false);
              setPageState({ status: "loading" });
              fetchLedger(filters, page);
            }}
          />
        </section>
      )}

      <section aria-labelledby="filters-heading">
        <h2 id="filters-heading" className="sr-only">Filtros</h2>
        <form className="ledger-filters" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Filtros do livro-caixa">
          <label>
            De
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange("from", e.target.value)}
              aria-label="Data inicial"
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange("to", e.target.value)}
              aria-label="Data final"
            />
          </label>
          <label>
            Tipo
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange("type", e.target.value)}
              aria-label="Tipo de lançamento"
            >
              <option value="">Todos</option>
              <option value="INCOME">Entrada</option>
              <option value="EXPENSE">Saída</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              aria-label="Status do lançamento"
            >
              <option value="">Todos</option>
              <option value="CONFIRMED">Confirmado</option>
              <option value="PENDING">Pendente</option>
            </select>
          </label>
          <button type="button" onClick={handleReset}>Limpar filtros</button>
        </form>
      </section>

      <section aria-live="polite">
        <LedgerTable
          entries={pageState.status === "ready" ? pageState.entries : []}
          loading={pageState.status === "loading"}
        />

        {pageState.status === "error" && (
          <p role="alert" className="error-message">{pageState.message}</p>
        )}

        {pageState.status === "ready" && pageState.meta.totalPages > 1 && (
          <nav aria-label="Paginação do livro-caixa" className="pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => { setPageState({ status: "loading" }); setPage((p) => p - 1); }}
              aria-label="Página anterior"
            >
              Anterior
            </button>
            <span aria-current="page">
              Página {pageState.meta.page} de {pageState.meta.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= pageState.meta.totalPages}
              onClick={() => { setPageState({ status: "loading" }); setPage((p) => p + 1); }}
              aria-label="Próxima página"
            >
              Próxima
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
