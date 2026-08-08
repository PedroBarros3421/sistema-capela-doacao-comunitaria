"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";

type Item = { id: string; name: string; unit: string };
type Line = { lotId: string; quantity: string; lotVersion: number };

export function MovementForm({ items, onSuccess }: { items: Item[]; onSuccess: () => void }) {
  const [type, setType] = useState<"DISTRIBUTION" | "DISCARD">("DISTRIBUTION");
  const [lines, setLines] = useState<Line[]>([]);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function suggest(form: HTMLFormElement) {
    const data = new FormData(form); setLoading(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/inventory/distribution-suggestion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: data.get("itemId"), quantity: data.get("quantity") }) });
      const payload = await response.json() as { data?: Line[]; error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível sugerir os lotes");
      setLines(payload.data ?? []);
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro de conexão" }); }
    finally { setLoading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); setMessage(null);
    const movementLines = type === "DISTRIBUTION" ? lines : [{ lotId: String(form.get("lotId")), quantity: String(form.get("quantity")) }];
    const body = { type, occurredOn: form.get("occurredOn"), projectId: type === "DISTRIBUTION" ? form.get("projectId") : undefined, reason: type === "DISCARD" ? form.get("reason") : undefined, note: form.get("note") || undefined, lines: movementLines };
    try {
      const response = await fetch("/api/admin/inventory/movements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível registrar a saída");
      setMessage({ kind: "success", text: type === "DISTRIBUTION" ? "Distribuição registrada." : "Descarte registrado." }); setLines([]); onSuccess();
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Erro de conexão" }); }
    finally { setLoading(false); }
  }

  return (
    <form className="inventory-form" onSubmit={submit} aria-label="Registrar movimentação de estoque">
      <fieldset disabled={loading}><legend>Registrar saída</legend>
        {message && <Alert variant={message.kind}>{message.text}</Alert>}
        <label>Tipo<select value={type} onChange={(event) => { setType(event.target.value as typeof type); setLines([]); }}><option value="DISTRIBUTION">Distribuição</option><option value="DISCARD">Descarte</option></select></label>
        {type === "DISTRIBUTION" ? <>
          <label>Item<select name="itemId" required><option value="">Selecione</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Quantidade total<input name="quantity" required inputMode="decimal" /></label>
          <Button type="button" variant="secondary" onClick={(event) => void suggest(event.currentTarget.form!)}>Sugerir lotes por validade</Button>
          <label>ID do projeto<input name="projectId" required /></label>
          {lines.length > 0 && <fieldset><legend>Sugestão ajustável</legend>{lines.map((line, index) => <label key={line.lotId}>Lote {line.lotId.slice(0, 8)}<input value={line.quantity} onChange={(event) => setLines((current) => current.map((entry, position) => position === index ? { ...entry, quantity: event.target.value } : entry))} /></label>)}</fieldset>}
        </> : <><label>ID do lote<input name="lotId" required /></label><label>Quantidade descartada<input name="quantity" required inputMode="decimal" /></label><label>Motivo<textarea name="reason" required maxLength={1000} /></label></>}
        <label>Data<input name="occurredOn" type="date" required /></label><label>Observação<textarea name="note" maxLength={1000} /></label>
      </fieldset><Button type="submit" loading={loading} disabled={type === "DISTRIBUTION" && lines.length === 0}>Confirmar movimentação</Button>
    </form>
  );
}
