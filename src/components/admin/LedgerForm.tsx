"use client";

import { type FormEvent, useState } from "react";

import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";
import { Field } from "@/components/shared/Field";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type Props = {
  onSuccess: () => void;
};

export function LedgerForm({ onSuccess }: Props) {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [destinationType, setDestinationType] = useState<"MOST_NEEDED" | "PROJECT">("MOST_NEEDED");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const form = new FormData(event.currentTarget);
    const projectId = form.get("projectId") as string | null;

    const body = {
      type: form.get("type") as string,
      amount: form.get("amount") as string,
      occurredOn: form.get("occurredOn") as string,
      method: form.get("method") as string,
      status: form.get("status") as string,
      destination: destinationType === "PROJECT" && projectId
        ? { type: "PROJECT", projectId }
        : { type: "MOST_NEEDED" },
    };

    try {
      const response = await fetch("/api/admin/ledger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setState({ status: "success", message: "Lançamento criado com sucesso." });
        (event.target as HTMLFormElement).reset();
        setDestinationType("MOST_NEEDED");
        onSuccess();
        return;
      }

      const err = await response.json() as { error: { message: string } };
      setState({ status: "error", message: err.error?.message ?? "Erro ao criar lançamento." });
    } catch {
      setState({ status: "error", message: "Erro de conexão." });
    }
  }

  const submitting = state.status === "submitting";

  return (
    <form className="ledger-entry-form" onSubmit={handleSubmit} noValidate aria-label="Novo lançamento manual">
      <fieldset disabled={submitting}>
        <legend>Novo lançamento</legend>

        {state.status === "success" && (
          <Alert variant="success">{state.message}</Alert>
        )}
        {state.status === "error" && (
          <Alert variant="error">{state.message}</Alert>
        )}

        <div className="form-row">
          <label htmlFor="entry-type">Tipo</label>
          <select id="entry-type" name="type" required>
            <option value="INCOME">Entrada</option>
            <option value="EXPENSE">Saída</option>
          </select>
        </div>

        <Field
          label="Valor (R$)"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          pattern="^\d+(\.\d{1,2})?$"
          disabled={submitting}
        />

        <Field
          label="Data do lançamento"
          name="occurredOn"
          type="date"
          required
          disabled={submitting}
        />

        <div className="form-row">
          <label htmlFor="entry-method">Método</label>
          <select id="entry-method" name="method" required>
            <option value="CASH">Dinheiro</option>
            <option value="PIX">Pix</option>
            <option value="CARD">Cartão</option>
            <option value="BOLETO">Boleto</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="entry-status">Status</label>
          <select id="entry-status" name="status" required>
            <option value="CONFIRMED">Confirmado</option>
            <option value="PENDING">Pendente</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="entry-destination">Destino</label>
          <select
            id="entry-destination"
            value={destinationType}
            onChange={(e) => setDestinationType(e.target.value as typeof destinationType)}
          >
            <option value="MOST_NEEDED">Geral</option>
            <option value="PROJECT">Projeto</option>
          </select>
        </div>

        {destinationType === "PROJECT" && (
          <Field
            label="ID do projeto"
            name="projectId"
            type="text"
            required
            disabled={submitting}
          />
        )}
      </fieldset>

      <Button type="submit" loading={submitting}>Criar lançamento</Button>
    </form>
  );
}
