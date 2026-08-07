"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AmountStep, type DonationTypeValue } from "@/components/donor/AmountStep";
import { DestinationStep, type DonorIdentityForm, type PublicProject } from "@/components/donor/DestinationStep";
import { DonationSummary } from "@/components/donor/DonationSummary";
import { MethodStep, type PaymentMethodValue } from "@/components/donor/MethodStep";
import { VolunteerHelp } from "@/components/donor/VolunteerHelp";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/shared/Button";

type PublicConfiguration = {
  projects: PublicProject[];
  volunteerHelp: { contact: string };
};

const emptyDonor: DonorIdentityForm = { name: "", email: "", phone: "", cpfCnpj: "" };

function normalizeAmount(value: string) {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount.toFixed(2);
}

export default function MoneyDonationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [donationType, setDonationType] = useState<DonationTypeValue>("ONE_OFF");
  const [amount, setAmount] = useState("50,00");
  const [method, setMethod] = useState<PaymentMethodValue>("PIX");
  const [destination, setDestination] = useState("MOST_NEEDED");
  const [donor, setDonor] = useState(emptyDonor);
  const [configuration, setConfiguration] = useState<PublicConfiguration>({ projects: [], volunteerHelp: { contact: "" } });
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const loadConfiguration = useCallback(async () => {
    setConfigurationLoading(true);
    setConfigurationError(null);
    try {
      const response = await fetch("/api/public/configuration");
      if (!response.ok) throw new Error();
      const { data } = await response.json() as { data: PublicConfiguration };
      setConfiguration(data);
    } catch {
      setConfigurationError("Não foi possível carregar os projetos. Você ainda pode escolher onde for mais necessário.");
    } finally {
      setConfigurationLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadConfiguration(), 0);
    return () => window.clearTimeout(task);
  }, [loadConfiguration]);

  const destinationName = destination === "MOST_NEEDED"
    ? "Onde for mais necessário"
    : configuration.projects.find(({ id }) => id === destination)?.name ?? "Projeto selecionado";

  function advance() {
    setError(null);
    if (step === 1 && !normalizeAmount(amount)) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function submitDonation() {
    if (submittingRef.current) return;
    const normalizedAmount = normalizeAmount(amount);
    if (!normalizedAmount) return setError("Informe um valor maior que zero.");
    if (donationType === "MONTHLY" && (!donor.name.trim() || !donor.email.trim())) {
      return setError("Informe nome e e-mail para registrar a doação mensal.");
    }
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const donorPayload = Object.fromEntries(Object.entries(donor).filter(([, value]) => value.trim()));
      const simulationResponse = await fetch("/api/public/payment-simulations", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          donationType,
          amount: normalizedAmount,
          method,
          destination: destination === "MOST_NEEDED" ? { type: "MOST_NEEDED" } : { type: "PROJECT", projectId: destination },
          ...(Object.keys(donorPayload).length ? { donor: donorPayload } : {}),
        }),
      });
      const simulationBody = await simulationResponse.json();
      if (!simulationResponse.ok) throw new Error(simulationBody.error?.message ?? "Não foi possível iniciar a simulação.");
      const confirmationResponse = await fetch(`/api/public/payment-simulations/${simulationBody.data.id}/confirmation`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ outcome: "CONFIRMED" }),
      });
      const confirmationBody = await confirmationResponse.json();
      if (!confirmationResponse.ok) throw new Error(confirmationBody.error?.message ?? "Não foi possível confirmar a simulação.");
      sessionStorage.setItem("donation-confirmation", JSON.stringify({
        confirmation: confirmationBody.data,
        donationType,
        amount: normalizedAmount.replace(".", ","),
        method,
        destinationName,
      }));
      router.push("/doar/obrigado");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a simulação.");
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="donor-page donor-flow">
      <header className="donor-flow__header">
        <a href="/doar" className="donor-back">← Voltar</a>
        <p className="donor-eyebrow">Etapa {step} de 3</p>
        <h1>Doação financeira</h1>
        <ol className="step-indicator" aria-label="Progresso da doação">
          {["Tipo e valor", "Método", "Destino e revisão"].map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step >= index + 1 ? "is-active" : ""}>
              <span>{index + 1}</span>{label}
            </li>
          ))}
        </ol>
      </header>

      <section className="donor-step" aria-live="polite">
        {error ? <Alert variant="error" title="Revise esta etapa">{error}</Alert> : null}
        {step === 1 ? <AmountStep donationType={donationType} amount={amount} onDonationTypeChange={setDonationType} onAmountChange={setAmount} /> : null}
        {step === 2 ? <MethodStep method={method} onChange={setMethod} /> : null}
        {step === 3 ? (
          <>
            {configurationLoading ? <p role="status">Carregando projetos…</p> : null}
            {configurationError ? (
              <Alert variant="error" title="Projetos indisponíveis">
                <p>{configurationError}</p>
                <Button type="button" variant="secondary" onClick={() => void loadConfiguration()}>Tentar carregar novamente</Button>
              </Alert>
            ) : null}
            {!configurationLoading && !configurationError && configuration.projects.length === 0 ? (
              <Alert title="Nenhum projeto ativo">Escolha “Onde for mais necessário” para continuar.</Alert>
            ) : null}
            <DestinationStep projects={configuration.projects} destination={destination} donor={donor} monthly={donationType === "MONTHLY"} onDestinationChange={setDestination} onDonorChange={setDonor} />
            <h2>Revise sua escolha</h2>
            <DonationSummary donationType={donationType} amount={amount} method={method} destinationName={destinationName} />
            <p className="simulation-banner" role="note">Ao confirmar, registraremos somente uma contribuição simulada. Nenhuma cobrança real será feita.</p>
          </>
        ) : null}
        <div className="donor-actions">
          {step > 1 ? <Button type="button" variant="secondary" size="large" onClick={() => setStep((current) => current - 1)}>Voltar uma etapa</Button> : null}
          {step < 3 ? <Button type="button" size="large" onClick={advance}>Continuar para {step === 1 ? "método" : "destino"}</Button> : null}
          {step === 3 ? <Button type="button" size="large" loading={loading} onClick={() => void submitDonation()}>Confirmar doação simulada</Button> : null}
        </div>
      </section>
      <VolunteerHelp contact={configuration.volunteerHelp.contact} />
    </main>
  );
}
