import Link from "next/link";

export function DonationChoice() {
  return (
    <div className="donation-choice">
      <article className="donation-card">
        <span className="donation-card__icon" aria-hidden="true">R$</span>
        <h2>Doar dinheiro</h2>
        <p>Escolha um valor e simule uma contribuição por Pix ou cartão, sem criar conta.</p>
        <Link className="donation-link donation-link--primary" href="/doar/dinheiro">Começar doação</Link>
      </article>
      <article className="donation-card">
        <span className="donation-card__icon" aria-hidden="true">♥</span>
        <h2>Doar itens</h2>
        <p>Fale com um voluntário para saber o que a comunidade precisa e combinar a entrega.</p>
        <a className="donation-link" href="#ajuda">Pedir orientação</a>
      </article>
    </div>
  );
}
