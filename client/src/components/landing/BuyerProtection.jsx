import { BadgeCheck, Banknote, CircleHelp, LockKeyhole, ShieldAlert } from 'lucide-react';

const PROTECTIONS = [
  { Icon: LockKeyhole, title: 'Your payment stays held', body: 'Funds are held in escrow while the seller completes the agreed transaction.' },
  { Icon: BadgeCheck, title: 'Know who you are paying', body: 'Seller identity checks and the transaction details are visible before payment.' },
  { Icon: ShieldAlert, title: 'A dispute pauses release', body: 'Raise a dispute if there is a problem; the funds stay frozen while it is reviewed.' },
  { Icon: Banknote, title: 'Clear Naira amounts', body: 'Review the price and payment amount before you confirm.' },
];

export default function BuyerProtection() {
  return (
    <section id="buyer-guidance" className="landing-section landing-protection landing-anchor">
      <div className="landing-container landing-protection-grid">
        <div>
          <div className="landing-section-heading">
            <p className="landing-overline">Buyer protection</p>
            <h2>Know where your money stands.</h2>
            <p>Escrow keeps the payment connected to the agreed delivery and confirmation steps.</p>
          </div>
          <ul className="landing-protection-list">
            {PROTECTIONS.map(({ Icon, title, body }) => (
              <li key={title}>
                <span><Icon size={19} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{body}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <aside className="landing-terms-card" aria-labelledby="terms-card-title">
          <p className="landing-overline">Before you pay</p>
          <h3 id="terms-card-title">Transaction terms at a glance</h3>
          <dl>
            <div><dt>Payment</dt><dd>Held by Escrit</dd></div>
            <div><dt>Delivery</dt><dd>Recorded against the agreement</dd></div>
            <div><dt>Confirmation</dt><dd>Buyer confirms or disputes</dd></div>
            <div><dt>Release</dt><dd>After confirmation or 72 hours after delivery</dd></div>
          </dl>
          <p><CircleHelp size={15} aria-hidden="true" /> Review the terms in your transaction link before paying.</p>
        </aside>
      </div>
    </section>
  );
}
