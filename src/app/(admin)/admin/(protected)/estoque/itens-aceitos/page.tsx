"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/shared/Button";

type Item = { id: string; name: string; category: string; unit: string; status: string; accepted: boolean; priority: boolean };

export default function ItensAceitosPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/inventory/items")
      .then(async (response) => {
        const body = await response.json() as { data?: Item[]; error?: { message: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar os itens");
        return body.data ?? [];
      })
      .then(setItems)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function updateItem(item: Item, patch: Partial<Pick<Item, "accepted" | "priority">>) {
    setPendingId(item.id);
    try {
      const response = await fetch(`/api/admin/inventory/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json() as { data?: Item; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Não foi possível salvar a alteração");
      setItems((current) => current.map((entry) => (entry.id === item.id ? body.data! : entry)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro de conexão");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="admin-accepted-items-page">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Estoque</p>
          <h1>Itens aceitos para doação</h1>
          <p className="page-header__description">
            Controle o que aparece para o doador em <code>/doar/itens</code>. A mudança fica visível
            para novos acessos públicos em poucos segundos.
          </p>
        </div>
      </header>
      {error ? <p className="error-message" role="alert">{error} <button type="button" onClick={() => { setError(null); setLoading(true); void load(); }}>Tentar novamente</button></p> : null}
      {loading ? <p aria-busy="true">Carregando itens…</p> : items.length === 0 ? (
        <p className="empty-state" role="status">Nenhum item cadastrado no catálogo ainda.</p>
      ) : (
        <div className="table-scroll">
          <table aria-label="Itens do catálogo e configuração pública">
            <thead>
              <tr><th>Item</th><th>Categoria</th><th>Aceito</th><th>Prioritário</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>
                    <Button
                      type="button"
                      variant={item.accepted ? "primary" : "secondary"}
                      aria-pressed={item.accepted}
                      disabled={pendingId === item.id}
                      onClick={() => void updateItem(item, { accepted: !item.accepted })}
                    >
                      {item.accepted ? "Aceito" : "Pausado"}
                    </Button>
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant={item.priority ? "primary" : "secondary"}
                      aria-pressed={item.priority}
                      disabled={!item.accepted || pendingId === item.id}
                      onClick={() => void updateItem(item, { priority: !item.priority })}
                    >
                      {item.priority ? "Prioritário" : "Comum"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
