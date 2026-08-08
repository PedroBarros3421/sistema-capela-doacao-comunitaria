"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/shared/Alert";

type Attempt = {
  id: string;
  attemptedEmail: string;
  occurredAt: string;
  ip: string | null;
  device: string | null;
  result: "SUCCESS" | "INVALID_CREDENTIALS" | "PENDING" | "INACTIVE" | "BLOCKED";
};

const RESULT_LABELS: Record<Attempt["result"], string> = {
  SUCCESS: "Sucesso",
  INVALID_CREDENTIALS: "Credenciais inválidas",
  PENDING: "Conta pendente",
  INACTIVE: "Conta inativa",
  BLOCKED: "Conta bloqueada",
};

type PageMeta = { total: number; page: number; pageSize: number; totalPages: number };

export default function AcessosPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/admin/login-attempts?${params.toString()}`)
      .then(async (response) => {
        const body = await response.json() as { data?: Attempt[]; meta?: PageMeta; error?: { message: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar o histórico");
        setAttempts(body.data ?? []);
        setMeta(body.meta ?? null);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, [page, from, to]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-access-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Governança</p>
          <h1>Histórico de acessos</h1>
          <p className="page-header__description">Consulte tentativas de login registradas no sistema.</p>
        </div>
      </header>

      <form
        role="search"
        aria-label="Filtrar histórico de acessos"
        className="ledger-filters"
        onSubmit={(e) => { e.preventDefault(); setLoading(true); setPage(1); load(); }}
      >
        <label>De<input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="submit">Filtrar</button>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? <p aria-busy="true">Carregando histórico…</p> : attempts.length === 0 ? (
        <p className="empty-state" role="status">Nenhuma tentativa de login registrada.</p>
      ) : (
        <div className="table-scroll">
          <table aria-label="Tentativas de login">
            <thead><tr><th>E-mail</th><th>Instante</th><th>IP</th><th>Resultado</th></tr></thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td>{attempt.attemptedEmail}</td>
                  <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(attempt.occurredAt))}</td>
                  <td>{attempt.ip ?? "—"}</td>
                  <td>{RESULT_LABELS[attempt.result]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="Paginação do histórico de acessos" className="pagination">
          <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((p) => p - 1); }}>Anterior</button>
          <span aria-current="page">Página {meta.page} de {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => { setLoading(true); setPage((p) => p + 1); }}>Próxima</button>
        </nav>
      )}
    </div>
  );
}
