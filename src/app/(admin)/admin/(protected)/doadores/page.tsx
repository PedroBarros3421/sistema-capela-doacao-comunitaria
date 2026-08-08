"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Donor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationshipType: string;
  origin: string;
  reviewStatus: string;
};

export default function DoadoresPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    fetch(`/api/admin/donors?${params}`)
      .then(async (response) => {
        const body = await response.json() as { data?: Donor[]; error?: { message: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar os doadores");
        return body.data ?? [];
      })
      .then(setDonors)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-donors-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Doadores</p>
          <h1>Doadores e recorrências</h1>
          <p className="page-header__description">
            Consulte o histórico de cada doador e acompanhe recorrências ativas.
          </p>
        </div>
        <div className="inventory-actions">
          <Link href="/admin/doadores/revisoes">Revisões de identidade</Link>
        </div>
      </header>

      <form
        role="search"
        onSubmit={(event) => { event.preventDefault(); setLoading(true); void load(); }}
      >
        <label htmlFor="donor-search">Buscar por nome, e-mail, telefone ou documento</label>
        <input
          id="donor-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>

      {error ? (
        <p className="error-message" role="alert">
          {error} <button type="button" onClick={() => { setError(null); setLoading(true); void load(); }}>Tentar novamente</button>
        </p>
      ) : null}

      {loading ? <p aria-busy="true">Carregando doadores…</p> : donors.length === 0 ? (
        <p className="empty-state" role="status">Nenhum doador encontrado.</p>
      ) : (
        <div className="table-scroll">
          <table aria-label="Doadores cadastrados">
            <thead>
              <tr><th>Nome</th><th>Contato</th><th>Tipo</th><th>Revisão</th><th /></tr>
            </thead>
            <tbody>
              {donors.map((donor) => (
                <tr key={donor.id}>
                  <td>{donor.name}</td>
                  <td>{donor.email ?? donor.phone ?? "—"}</td>
                  <td>{donor.relationshipType}</td>
                  <td>{donor.reviewStatus === "PENDING_REVIEW" ? "Em revisão" : "Ok"}</td>
                  <td><Link href={`/admin/doadores/${donor.id}`}>Ver histórico</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
