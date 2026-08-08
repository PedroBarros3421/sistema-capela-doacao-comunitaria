"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { InventoryTable, type ConsolidatedInventory } from "@/components/admin/InventoryTable";
import { LotForm } from "@/components/admin/LotForm";
import { MovementForm } from "@/components/admin/MovementForm";

type Item = { id: string; name: string; unit: string };

export default function EstoquePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [inventory, setInventory] = useState<ConsolidatedInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<"" | "7" | "30">("");
  const [panel, setPanel] = useState<"lot" | "movement" | null>(null);

  const load = useCallback(() => {
    const query = new URLSearchParams({ includeLots: "true" }); if (windowDays) query.set("expiryWindowDays", windowDays);
    Promise.all([fetch("/api/admin/inventory/items"), fetch(`/api/admin/inventory/lots?${query}`)])
      .then(async ([itemsResponse, lotsResponse]) => {
        const itemBody = await itemsResponse.json() as { data?: Item[]; error?: { message: string } };
        const lotBody = await lotsResponse.json() as { data?: ConsolidatedInventory[]; error?: { message: string } };
        if (!itemsResponse.ok || !lotsResponse.ok) throw new Error(itemBody.error?.message ?? lotBody.error?.message ?? "Não foi possível carregar o estoque");
        return { items: itemBody.data ?? [], inventory: lotBody.data ?? [] };
      })
      .then((result) => { setItems(result.items); setInventory(result.inventory); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"))
      .finally(() => setLoading(false));
  }, [windowDays]);
  useEffect(() => { void load(); }, [load]);

  return <div className="admin-inventory-page">
    <header className="page-header"><div><p className="page-header__eyebrow">Estoque</p><h1>Itens e lotes</h1><p className="page-header__description">Acompanhe saldos, validades, recebimentos e saídas rastreáveis.</p></div><div className="inventory-actions"><button type="button" onClick={() => setPanel(panel === "lot" ? null : "lot")}>Receber lote</button><button type="button" onClick={() => setPanel(panel === "movement" ? null : "movement")}>Registrar saída</button><Link href="/admin/estoque/itens-aceitos">Itens aceitos</Link></div></header>
    {panel === "lot" && <section className="inventory-panel"><LotForm items={items} onSuccess={() => { setLoading(true); void load(); }} /></section>}
    {panel === "movement" && <section className="inventory-panel"><MovementForm items={items} onSuccess={() => { setLoading(true); void load(); }} /></section>}
    <section aria-labelledby="inventory-filter-heading"><h2 id="inventory-filter-heading" className="sr-only">Alertas de validade</h2><div className="inventory-filters" role="group" aria-label="Filtrar alertas de validade"><button type="button" aria-pressed={windowDays === ""} onClick={() => { setLoading(true); setWindowDays(""); }}>Todo o estoque</button><button type="button" aria-pressed={windowDays === "7"} onClick={() => { setLoading(true); setWindowDays("7"); }}>Vence em 7 dias</button><button type="button" aria-pressed={windowDays === "30"} onClick={() => { setLoading(true); setWindowDays("30"); }}>Vence em 30 dias</button></div></section>
    {error ? <p className="error-message" role="alert">{error} <button type="button" onClick={() => { setError(null); setLoading(true); void load(); }}>Tentar novamente</button></p> : <InventoryTable inventory={inventory} loading={loading} />}
  </div>;
}
