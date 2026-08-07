"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { DonationSummary } from "@/components/donor/DonationSummary";
import { VolunteerHelp } from "@/components/donor/VolunteerHelp";

type StoredConfirmation = {
  confirmation: { thankYouMessage: string; receiptId: string | null; accountAccessUrl: string | null };
  donationType: "ONE_OFF" | "MONTHLY";
  amount: string;
  method: "PIX" | "CARD";
  destinationName: string;
};

export default function DonationThanksPage() {
  const stored = useSyncExternalStore(
    () => () => undefined,
    () => sessionStorage.getItem("donation-confirmation"),
    () => null,
  );
  const result = useMemo(() => stored ? JSON.parse(stored) as StoredConfirmation : null, [stored]);

  return (
    <main className="donor-page donor-thanks">
      <div className="donor-thanks__mark" aria-hidden="true">✓</div>
      <h1>Muito obrigado!</h1>
      <p>{result?.confirmation.thankYouMessage ?? "Sua contribuição simulada foi concluída."}</p>
      <p className="simulation-banner" role="note">Este foi um fluxo demonstrativo; nenhuma cobrança real foi realizada.</p>
      {result ? <DonationSummary donationType={result.donationType} amount={result.amount} method={result.method} destinationName={result.destinationName} /> : null}
      <section className="next-steps" aria-labelledby="next-steps-title">
        <h2 id="next-steps-title">Próximos passos</h2>
        <ol>
          <li>Guarde esta confirmação para sua referência.</li>
          <li>{result?.confirmation.receiptId ? "Seu recibo foi preparado." : "Se você se identificou com CPF ou CNPJ, o recibo fica vinculado à contribuição."}</li>
          <li>Um voluntário pode explicar qualquer etapa ou orientar uma doação presencial.</li>
        </ol>
      </section>
      {result?.confirmation.accountAccessUrl ? <a className="donation-link donation-link--primary" href={result.confirmation.accountAccessUrl}>Acessar minha conta</a> : null}
      <Link className="donation-link" href="/doar">Voltar ao início</Link>
      <VolunteerHelp />
    </main>
  );
}
