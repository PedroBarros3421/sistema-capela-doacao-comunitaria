import { Field } from "@/components/shared/Field";

export type DonationTypeValue = "ONE_OFF" | "MONTHLY";

type AmountStepProps = {
  donationType: DonationTypeValue;
  amount: string;
  onDonationTypeChange: (value: DonationTypeValue) => void;
  onAmountChange: (value: string) => void;
};

export function AmountStep({ donationType, amount, onDonationTypeChange, onAmountChange }: AmountStepProps) {
  return (
    <fieldset className="donor-step__fieldset">
      <legend>Escolha o tipo e o valor</legend>
      <div className="donor-options donor-options--two">
        <label className="donor-option">
          <input type="radio" name="donationType" value="ONE_OFF" checked={donationType === "ONE_OFF"} onChange={() => onDonationTypeChange("ONE_OFF")} />
          <span><strong>Doação única</strong><small>Uma contribuição feita hoje</small></span>
        </label>
        <label className="donor-option">
          <input type="radio" name="donationType" value="MONTHLY" checked={donationType === "MONTHLY"} onChange={() => onDonationTypeChange("MONTHLY")} />
          <span><strong>Doação mensal</strong><small>Compromisso recorrente simulado</small></span>
        </label>
      </div>
      <div className="suggested-values" aria-label="Valores sugeridos">
        {["25,00", "50,00", "100,00"].map((value) => (
          <button type="button" key={value} onClick={() => onAmountChange(value)} aria-pressed={amount === value}>R$ {value}</button>
        ))}
      </div>
      <Field label="Outro valor" value={amount} onChange={(event) => onAmountChange(event.target.value)} inputMode="decimal" placeholder="0,00" required />
    </fieldset>
  );
}
