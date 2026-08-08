"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/shared/Button";

type Review = {
  id: string;
  submittedDonorId: string;
  candidateDonorIds: string[];
  reason: string;
  status: string;
  openedAt: string;
};

export default function RevisoesDoadoresPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [survivors, setSurvivors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch("/api/admin/donor-match-reviews?status=OPEN")
      .then(async (response) => {
        const body = await response.json() as { data?: Review[]; error?: { message: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar as revisões");
        return body.data ?? [];
      })
      .then(setReviews)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function resolve(review: Review, decision: "KEEP_SEPARATE" | "MERGE") {
    const note = notes[review.id]?.trim();
    if (!note) {
      setError("Informe uma nota de resolução antes de continuar.");
      return;
    }
    if (decision === "MERGE" && !survivors[review.id]) {
      setError("Selecione o doador que deve permanecer após a fusão.");
      return;
    }

    setPendingId(review.id);
    try {
      const response = await fetch(`/api/admin/donor-match-reviews/${review.id}/resolution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          decision === "MERGE"
            ? { decision, survivingDonorId: survivors[review.id], note }
            : { decision, note },
        ),
      });
      const body = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível resolver a revisão");
      setReviews((current) => current.filter((entry) => entry.id !== review.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro de conexão");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="admin-donor-reviews-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Doadores</p>
          <h1>Revisões de identidade</h1>
          <p className="page-header__description">
            Decida se cadastros conflitantes devem permanecer separados ou ser unificados.
          </p>
        </div>
      </header>

      {error ? (
        <p className="error-message" role="alert">
          {error} <button type="button" onClick={() => { setError(null); setLoading(true); void load(); }}>Tentar novamente</button>
        </p>
      ) : null}

      {loading ? <p aria-busy="true">Carregando revisões…</p> : reviews.length === 0 ? (
        <p className="empty-state" role="status">Nenhuma revisão pendente.</p>
      ) : (
        <ul role="list">
          {reviews.map((review) => (
            <li key={review.id} className="inventory-panel">
              <p>Cadastro provisório {review.submittedDonorId}</p>
              <p>Candidatos: {review.candidateDonorIds.join(", ")}</p>
              <label htmlFor={`note-${review.id}`}>Nota de resolução</label>
              <textarea
                id={`note-${review.id}`}
                value={notes[review.id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))}
              />
              <label htmlFor={`survivor-${review.id}`}>Doador que deve permanecer (para fusão)</label>
              <select
                id={`survivor-${review.id}`}
                value={survivors[review.id] ?? ""}
                onChange={(event) => setSurvivors((current) => ({ ...current, [review.id]: event.target.value }))}
              >
                <option value="">Selecione…</option>
                {review.candidateDonorIds.map((candidateId) => (
                  <option key={candidateId} value={candidateId}>{candidateId}</option>
                ))}
              </select>
              <div className="inventory-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pendingId === review.id}
                  onClick={() => void resolve(review, "KEEP_SEPARATE")}
                >
                  Manter separados
                </Button>
                <Button
                  type="button"
                  disabled={pendingId === review.id}
                  onClick={() => void resolve(review, "MERGE")}
                >
                  Unificar cadastros
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
