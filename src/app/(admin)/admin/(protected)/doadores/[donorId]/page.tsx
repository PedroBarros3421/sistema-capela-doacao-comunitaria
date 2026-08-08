"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type TimelineEntry =
  | { type: "DONATION"; id: string; occurredOn: string; amount: string; projectName: string }
  | { type: "IN_KIND"; id: string; occurredOn: string; quantity: string; itemName: string; unit: string };

type Subscription = {
  id: string;
  amount: string;
  status: string;
  method: string;
  nextChargeDate: string | null;
  destination: { type: string; projectId?: string };
};

type DonorDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  documentMasked: string | null;
  reviewStatus: string;
  timeline: TimelineEntry[];
  subscriptions: Subscription[];
};

export default function DoadorDetalhePage() {
  const params = useParams<{ donorId: string }>();
  const [donor, setDonor] = useState<DonorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/donors/${params.donorId}`)
      .then(async (response) => {
        const body = await response.json() as { data?: DonorDetail; error?: { message: string } };
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Não foi possível carregar o doador");
        return body.data;
      })
      .then(setDonor)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, [params.donorId]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <p aria-busy="true">Carregando doador…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (!donor) return null;

  return (
    <div className="admin-donor-detail-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Doadores</p>
          <h1>{donor.name}</h1>
          <p className="page-header__description">
            {donor.email ?? "—"} · {donor.phone ?? "—"} · CPF/CNPJ {donor.documentMasked ?? "não informado"}
          </p>
        </div>
      </header>

      {donor.reviewStatus === "PENDING_REVIEW" && (
        <p role="status">Este cadastro aguarda revisão de identidade.</p>
      )}

      <section aria-labelledby="donor-subscriptions-heading">
        <h2 id="donor-subscriptions-heading">Recorrências</h2>
        {donor.subscriptions.length === 0 ? (
          <p className="empty-state" role="status">Nenhuma recorrência cadastrada.</p>
        ) : (
          <ul role="list">
            {donor.subscriptions.map((subscription) => (
              <li key={subscription.id}>
                R$ {subscription.amount} · {subscription.method} · {subscription.status}
                {subscription.nextChargeDate ? ` · próxima referência ${subscription.nextChargeDate}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="donor-timeline-heading">
        <h2 id="donor-timeline-heading">Linha do tempo</h2>
        {donor.timeline.length === 0 ? (
          <p className="empty-state" role="status">Nenhuma contribuição registrada ainda.</p>
        ) : (
          <ul role="list">
            {donor.timeline.map((entry) => (
              <li key={entry.id}>
                {entry.occurredOn} ·{" "}
                {entry.type === "DONATION"
                  ? `R$ ${entry.amount} para ${entry.projectName}`
                  : `${entry.quantity} ${entry.unit} de ${entry.itemName}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
