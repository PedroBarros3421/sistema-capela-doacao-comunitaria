"use client";

import { useCallback, useEffect, useState } from "react";
import { VolunteerHelp } from "@/components/donor/VolunteerHelp";

type AcceptedItem = { id: string; name: string; category: string; unit: string; priority: boolean };
type Configuration = {
  volunteerHelp: { label: string; contact: string };
  itemDelivery: { address: string; instructions: string };
};

const UNIT_LABELS: Record<string, string> = { KG: "quilos", UNIT: "unidades", LITER: "litros" };

export default function DoarItensPage() {
  const [items, setItems] = useState<AcceptedItem[] | null>(null);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetch("/api/public/accepted-items"), fetch("/api/public/configuration")])
      .then(async ([itemsResponse, configResponse]) => {
        const itemsBody = await itemsResponse.json() as { data?: AcceptedItem[]; error?: { message: string } };
        const configBody = await configResponse.json() as { data?: Configuration; error?: { message: string } };
        if (!itemsResponse.ok || !configResponse.ok) {
          throw new Error(itemsBody.error?.message ?? configBody.error?.message ?? "Não foi possível carregar os itens aceitos");
        }
        return { items: itemsBody.data ?? [], configuration: configBody.data ?? null };
      })
      .then((result) => { setItems(result.items); setConfiguration(result.configuration); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro de conexão"));
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <main className="donor-page">
      <header className="donor-hero">
        <span className="donor-eyebrow">Capela Comunitária</span>
        <h1>Itens aceitos para doação</h1>
        <p>Esta página é só uma orientação. A entrega é combinada com um voluntário presencialmente.</p>
      </header>
      {error ? (
        <p className="error-message" role="alert">{error} <button type="button" onClick={() => { setError(null); setItems(null); load(); }}>Tentar novamente</button></p>
      ) : items === null ? (
        <p aria-busy="true">Carregando itens aceitos…</p>
      ) : items.length === 0 ? (
        <p className="empty-state" role="status">No momento não há itens em destaque; fale com um voluntário para saber a necessidade atual.</p>
      ) : (
        <ul className="accepted-items-list" aria-label="Itens aceitos no momento">
          {items.map((item) => (
            <li key={item.id} className={item.priority ? "accepted-item accepted-item--priority" : "accepted-item"}>
              <strong>{item.name}</strong>
              <span>{item.category} · {UNIT_LABELS[item.unit] ?? item.unit}</span>
              {item.priority ? <span className="accepted-item__badge">Necessidade prioritária</span> : null}
            </li>
          ))}
        </ul>
      )}
      {configuration ? (
        <section aria-label="Onde entregar" className="donor-delivery-info">
          <h2>Onde entregar</h2>
          <p>{configuration.itemDelivery.address}</p>
          <p>{configuration.itemDelivery.instructions}</p>
        </section>
      ) : null}
      <div id="ajuda"><VolunteerHelp contact={configuration?.volunteerHelp.contact} /></div>
    </main>
  );
}
