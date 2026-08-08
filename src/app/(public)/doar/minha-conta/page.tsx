"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";
import { Field } from "@/components/shared/Field";

type Subscription = {
  id: string;
  amount: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  method: string;
  nextChargeDate: string | null;
};

type DonorAccount = {
  donor: { name: string; email: string | null; phone: string | null; documentMasked: string | null };
  donations: { id: string; occurredOn: string; amount: string; projectName: string; receiptId: string | null }[];
  subscriptions: Subscription[];
};

function AccessRequestForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const form = new FormData(event.currentTarget);
    await fetch("/api/public/account/access-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifierType: form.get("identifierType"),
        identifier: form.get("identifier"),
        contact: form.get("contact"),
      }),
    });
    setStatus("sent");
  }

  return (
    <main className="public-access-page">
      <div className="public-access-card">
        <header>
          <h1>Minha conta</h1>
          <p>Use o link pessoal enviado após sua doação ou solicite acesso por CPF, CNPJ ou referência Pix.</p>
        </header>

        {status === "sent" ? (
          <Alert variant="info">
            Se os dados informados corresponderem a um cadastro, você receberá as instruções em breve.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="shared-field">
              <label className="shared-field__label" htmlFor="identifierType">Tipo de identificação</label>
              <select id="identifierType" name="identifierType" required defaultValue="CPF_CNPJ">
                <option value="CPF_CNPJ">CPF ou CNPJ</option>
                <option value="PIX_REFERENCE">Referência Pix</option>
              </select>
            </div>
            <Field label="Identificador" name="identifier" required disabled={status === "submitting"} />
            <Field label="E-mail ou telefone associado" name="contact" required disabled={status === "submitting"} />
            <Button type="submit" loading={status === "submitting"}>Solicitar acesso</Button>
          </form>
        )}
      </div>
    </main>
  );
}

function AccountView({ token }: { token: string }) {
  const [account, setAccount] = useState<DonorAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/public/account", { headers: { authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const body = await response.json() as { data?: DonorAccount; error?: { message: string } };
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Não foi possível carregar sua conta");
        return body.data;
      })
      .then(setAccount)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function updateSubscription(subscriptionId: string, action: "PAUSE" | "RESUME" | "CANCEL") {
    setPendingId(subscriptionId);
    try {
      const response = await fetch(`/api/public/account/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: { message: string } };
        throw new Error(body.error?.message ?? "Não foi possível atualizar a recorrência");
      }
      setLoading(true);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro de conexão");
    } finally {
      setPendingId(null);
    }
  }

  async function downloadReceipt(receiptId: string) {
    const response = await fetch(`/api/public/account/receipts/${receiptId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recibo-${receiptId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <main className="public-access-page" aria-busy="true" />;
  if (error) return <main className="public-access-page"><Alert variant="error">{error}</Alert></main>;
  if (!account) return null;

  return (
    <main className="public-access-page">
      <div className="public-access-card">
        <header>
          <h1>Olá, {account.donor.name}</h1>
          <p>
            {account.donor.email ?? "—"} · {account.donor.phone ?? "—"} · CPF/CNPJ {account.donor.documentMasked ?? "não informado"}
          </p>
        </header>

        <section aria-labelledby="my-subscriptions-heading">
          <h2 id="my-subscriptions-heading">Minhas recorrências</h2>
          {account.subscriptions.length === 0 ? (
            <p className="empty-state" role="status">Você não tem recorrências ativas.</p>
          ) : (
            <ul role="list">
              {account.subscriptions.map((subscription) => (
                <li key={subscription.id}>
                  R$ {subscription.amount} · {subscription.status}
                  {subscription.nextChargeDate ? ` · próxima referência ${subscription.nextChargeDate}` : ""}
                  <div className="inventory-actions">
                    {subscription.status === "ACTIVE" && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pendingId === subscription.id}
                        onClick={() => void updateSubscription(subscription.id, "PAUSE")}
                      >
                        Pausar
                      </Button>
                    )}
                    {subscription.status === "PAUSED" && (
                      <Button
                        type="button"
                        disabled={pendingId === subscription.id}
                        onClick={() => void updateSubscription(subscription.id, "RESUME")}
                      >
                        Retomar
                      </Button>
                    )}
                    {subscription.status !== "CANCELLED" && (
                      <Button
                        type="button"
                        variant="danger"
                        disabled={pendingId === subscription.id}
                        onClick={() => void updateSubscription(subscription.id, "CANCEL")}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="my-donations-heading">
          <h2 id="my-donations-heading">Meu histórico</h2>
          {account.donations.length === 0 ? (
            <p className="empty-state" role="status">Nenhuma doação registrada ainda.</p>
          ) : (
            <ul role="list">
              {account.donations.map((donation) => (
                <li key={donation.id}>
                  {donation.occurredOn} · R$ {donation.amount} para {donation.projectName}
                  {donation.receiptId ? (
                    <Button type="button" variant="secondary" onClick={() => void downloadReceipt(donation.receiptId!)}>
                      Baixar recibo
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function MinhaContaContent() {
  const token = useSearchParams().get("token");
  return token ? <AccountView token={token} /> : <AccessRequestForm />;
}

export default function MinhaContaPage() {
  return (
    <Suspense fallback={<main className="public-access-page" aria-busy="true" />}>
      <MinhaContaContent />
    </Suspense>
  );
}
