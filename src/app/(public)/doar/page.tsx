import { DonationChoice } from "@/components/donor/DonationChoice";
import { VolunteerHelp } from "@/components/donor/VolunteerHelp";

export default function DonatePage() {
  return (
    <main className="donor-page">
      <header className="donor-hero">
        <span className="donor-eyebrow">Capela Comunitária</span>
        <h1>Como você quer ajudar hoje?</h1>
        <p>Sua contribuição fortalece o cuidado com as famílias da nossa comunidade.</p>
      </header>
      <DonationChoice />
      <div id="ajuda"><VolunteerHelp /></div>
    </main>
  );
}
