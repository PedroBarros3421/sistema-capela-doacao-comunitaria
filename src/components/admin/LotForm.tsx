"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";

type Item = { id: string; name: string; unit: string };

export function LotForm({ items, onSuccess }: { items: Item[]; onSuccess: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("loading");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      itemId: String(form.get("itemId")), quantity: String(form.get("quantity")), receivedOn: String(form.get("receivedOn")),
      expiresOn: form.get("expiresOn") ? String(form.get("expiresOn")) : null,
      donorName: form.get("donorName") ? String(form.get("donorName")) : undefined,
      valuationSource: manual ? "MANUAL" : "AVERAGE_AT_RECEIPT",
      estimatedValue: manual ? String(form.get("estimatedValue")) : undefined,
    };
    try {
      const response = await fetch("/api/admin/inventory/lots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível cadastrar o lote");
      setStatus("success"); setMessage("Lote cadastrado com sucesso."); formElement.reset(); setManual(false); onSuccess();
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Erro de conexão"); }
  }
  return (
    <form className="inventory-form" onSubmit={submit} aria-label="Receber novo lote">
      <fieldset disabled={status === "loading"}><legend>Receber novo lote</legend>
        {status === "success" && <Alert variant="success">{message}</Alert>}{status === "error" && <Alert variant="error">{message}</Alert>}
        <label>Item<select name="itemId" required><option value="">Selecione</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>
        <label>Quantidade<input name="quantity" inputMode="decimal" pattern="^\d+(\.\d{1,3})?$" required /></label>
        <label>Data de recebimento<input name="receivedOn" type="date" required /></label>
        <label>Validade opcional<input name="expiresOn" type="date" /></label>
        <label>Doador opcional<input name="donorName" maxLength={160} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} /> Informar valor estimado manualmente</label>
        {manual && <label>Valor estimado (R$)<input name="estimatedValue" inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" required /></label>}
      </fieldset><Button type="submit" loading={status === "loading"}>Cadastrar lote</Button>
    </form>
  );
}
