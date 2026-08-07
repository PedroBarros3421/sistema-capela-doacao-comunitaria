export type PaymentMethodValue = "PIX" | "CARD";

export function MethodStep({ method, onChange }: { method: PaymentMethodValue; onChange: (value: PaymentMethodValue) => void }) {
  return (
    <fieldset className="donor-step__fieldset">
      <legend>Escolha como simular</legend>
      <div className="donor-options donor-options--two">
        <label className="donor-option">
          <input type="radio" name="method" value="PIX" checked={method === "PIX"} onChange={() => onChange("PIX")} />
          <span><strong>Pix simulado</strong><small>Exibe um código demonstrativo, não pagável</small></span>
        </label>
        <label className="donor-option">
          <input type="radio" name="method" value="CARD" checked={method === "CARD"} onChange={() => onChange("CARD")} />
          <span><strong>Cartão simulado</strong><small>Não solicita dados reais do cartão</small></span>
        </label>
      </div>
      <p className="simulation-banner" role="note">Esta experiência é uma simulação. Nenhum valor será cobrado.</p>
    </fieldset>
  );
}
