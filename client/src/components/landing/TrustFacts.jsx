import { Banknote, Clock3, ShieldCheck, UserRoundCheck } from 'lucide-react';

const FACTS = [
  { Icon: Clock3, title: '72 hours', body: 'Auto-release after delivery' },
  { Icon: ShieldCheck, title: 'Escrow held', body: 'Escrow payments stay on hold until release' },
  { Icon: UserRoundCheck, title: 'KYC checked', body: 'Every seller goes through verification' },
  { Icon: Banknote, title: 'Naira payments', body: 'Pay and get paid in ₦' },
];

export default function TrustFacts() {
  return (
    <section className="landing-facts" aria-label="Escrit marketplace and escrow facts">
      <div className="landing-container landing-facts-grid">
        {FACTS.map(({ Icon, title, body }) => (
          <article key={title} className="landing-fact">
            <span className="landing-fact-icon"><Icon size={19} aria-hidden="true" /></span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
