"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";
import type { ReportSnapshot } from "@/server/domains/reports/report-service";
import type { SerializedPublication } from "@/server/domains/reports/publication-service";

function formatBRL(value: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value));
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export default function RelatoriosPage() {
  const [filters, setFilters] = useState(() => ({ ...currentMonthRange(), category: "" }));
  const [preview, setPreview] = useState<ReportSnapshot | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publications, setPublications] = useState<SerializedPublication[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const params = new URLSearchParams({ from: filters.from, to: filters.to });
      if (filters.category) params.set("category", filters.category);
      const response = await fetch(`/api/admin/reports/preview?${params.toString()}`);
      const body = await response.json() as { data?: ReportSnapshot; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível gerar a prévia");
      setPreview(body.data ?? null);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Erro de conexão");
    } finally {
      setLoadingPreview(false);
    }
  }, [filters]);

  const loadPublications = useCallback(async () => {
    const response = await fetch("/api/admin/reports/publications");
    const body = await response.json() as { data?: SerializedPublication[] };
    setPublications(body.data ?? []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPreview();
      loadPublications();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPreview, loadPublications]);

  async function handlePublish() {
    setPublishing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/reports/publications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: filters.from, to: filters.to, category: filters.category || undefined, generatePdf: true }),
      });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível publicar a prestação de contas");
      setMessage({ kind: "success", text: "Prestação de contas publicada." });
      await loadPublications();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro de conexão" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="admin-reports-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Transparência</p>
          <h1>Prestação de contas</h1>
          <p className="page-header__description">
            Gere a prévia de um período e publique uma versão imutável para o público.
          </p>
        </div>
      </header>

      <form
        className="report-filters"
        role="search"
        aria-label="Filtros da prestação de contas"
        onSubmit={(event) => { event.preventDefault(); void loadPreview(); }}
      >
        <label>De<input type="date" required value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></label>
        <label>Até<input type="date" required value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></label>
        <label>Categoria<input value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} placeholder="Todas" /></label>
        <Button type="submit" loading={loadingPreview}>Gerar prévia</Button>
      </form>

      {message && <Alert variant={message.kind}>{message.text}</Alert>}
      {previewError && <Alert variant="error">{previewError}</Alert>}

      {preview && (
        <section aria-labelledby="preview-heading" className="report-preview">
          <h2 id="preview-heading">Prévia — {preview.from} a {preview.to}</h2>
          <div className="kpi-grid" role="list" aria-label="Totais do período">
            <article className="kpi-card"><p className="kpi-label">Arrecadado</p><p className="kpi-value">{formatBRL(preview.totals.moneyRaised)}</p></article>
            <article className="kpi-card"><p className="kpi-label">Gasto</p><p className="kpi-value">{formatBRL(preview.totals.moneySpent)}</p></article>
            <article className="kpi-card"><p className="kpi-label">Bens recebidos</p><p className="kpi-value">{formatBRL(preview.totals.inKindReceived)}</p></article>
          </div>

          {preview.byProject.length > 0 && (
            <table className="report-table">
              <caption>Por projeto</caption>
              <thead><tr><th scope="col">Projeto</th><th scope="col">Arrecadado</th><th scope="col">Gasto</th></tr></thead>
              <tbody>
                {preview.byProject.map((p) => (
                  <tr key={p.projectId}><td>{p.projectName}</td><td>{formatBRL(p.moneyRaised)}</td><td>{formatBRL(p.moneySpent)}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <table className="report-table">
            <caption>Estoque: giro e perdas</caption>
            <thead><tr><th scope="col">Item</th><th scope="col">Recebido</th><th scope="col">Distribuído</th><th scope="col">Giro</th></tr></thead>
            <tbody>
              {preview.inventory.turnoverByItem.map((item) => (
                <tr key={item.itemId}><td>{item.itemName}</td><td>{item.receivedQuantity}</td><td>{item.distributedQuantity}</td><td>{item.turnoverRate}</td></tr>
              ))}
            </tbody>
          </table>
          <p>Quantidade vencida: {preview.inventory.expiredQuantity} · Descartado: {preview.inventory.discardedQuantity} ({formatBRL(preview.inventory.discardedValue)})</p>

          <Button type="button" onClick={() => void handlePublish()} loading={publishing}>
            Publicar esta versão
          </Button>
        </section>
      )}

      <section aria-labelledby="publications-heading">
        <h2 id="publications-heading">Versões publicadas</h2>
        {publications.length === 0 ? (
          <p>Nenhuma prestação de contas foi publicada ainda.</p>
        ) : (
          <ul className="publications-list">
            {publications.map((publication) => (
              <li key={publication.id}>
                {publication.from} a {publication.to} — publicado em{" "}
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(publication.publishedAt))}
                {publication.id === publications[0]?.id && <strong> (versão pública atual)</strong>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
