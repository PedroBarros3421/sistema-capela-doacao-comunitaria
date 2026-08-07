type DonationSummaryProps = {
  donationType: "ONE_OFF" | "MONTHLY";
  amount: string;
  method: "PIX" | "CARD";
  destinationName: string;
};

export function DonationSummary({ donationType, amount, method, destinationName }: DonationSummaryProps) {
  return (
    <dl className="donation-summary">
      <div><dt>Contribuição</dt><dd>{donationType === "MONTHLY" ? "Mensal" : "Única"}</dd></div>
      <div><dt>Valor</dt><dd>R$ {amount}</dd></div>
      <div><dt>Método</dt><dd>{method === "PIX" ? "Pix simulado" : "Cartão simulado"}</dd></div>
      <div><dt>Destino</dt><dd>{destinationName}</dd></div>
    </dl>
  );
}
