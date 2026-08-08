export type InventoryLotView = {
  id: string; availableQuantity: string; receivedOn: string; expiresOn: string | null;
  donorName: string | null; status: string; alertLevel: "NONE" | "ATTENTION" | "URGENT";
};

export type ConsolidatedInventory = {
  item: { id: string; name: string; category: string; unit: string };
  availableQuantity: string;
  lotCount: number;
  lots?: InventoryLotView[];
};

const ALERT_LABELS = { NONE: "Sem alerta", ATTENTION: "Vence entre 8 e 30 dias", URGENT: "Vence em até 7 dias" } as const;

export function InventoryTable({ inventory, loading }: { inventory: ConsolidatedInventory[]; loading: boolean }) {
  if (loading) return <p aria-busy="true">Carregando estoque…</p>;
  if (inventory.length === 0) return <p className="empty-state" role="status">Nenhum item encontrado no estoque.</p>;
  return (
    <div className="inventory-list">
      {inventory.map((entry) => (
        <details key={entry.item.id} className="inventory-item-card">
          <summary>
            <span><strong>{entry.item.name}</strong><small>{entry.item.category}</small></span>
            <span><strong>{entry.availableQuantity} {entry.item.unit}</strong><small>{entry.lotCount} lote(s)</small></span>
          </summary>
          {entry.lots?.length ? (
            <div className="table-scroll">
              <table aria-label={`Lotes de ${entry.item.name}`}>
                <thead><tr><th>Lote</th><th>Disponível</th><th>Recebido</th><th>Validade</th><th>Doador</th><th>Alerta</th></tr></thead>
                <tbody>{entry.lots.map((lot) => (
                  <tr key={lot.id}>
                    <td><code>{lot.id.slice(0, 8)}</code></td><td>{lot.availableQuantity} {entry.item.unit}</td>
                    <td>{lot.receivedOn}</td><td>{lot.expiresOn ?? "Sem validade"}</td><td>{lot.donorName ?? "Não informado"}</td>
                    <td><span className={`expiry-badge expiry-badge--${lot.alertLevel.toLowerCase()}`}>{ALERT_LABELS[lot.alertLevel]}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty-state">Sem lotes para este filtro.</p>}
        </details>
      ))}
    </div>
  );
}
