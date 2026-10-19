import { Check, PackageCheck, Wallet, CircleCheck } from 'lucide-react';

const STEPS = [
  { number: '01', title: 'You pay', body: 'The buyer pays into Escrit escrow.', Icon: Wallet },
  { number: '02', title: 'Seller delivers', body: 'The seller completes delivery or the agreed work.', Icon: PackageCheck },
  { number: '03', title: 'You confirm', body: 'The buyer confirms, or raises a dispute if something is wrong.', Icon: CircleCheck },
  { number: '04', title: 'Seller is paid', body: 'Funds are released after confirmation or the 72-hour delivery window.', Icon: Check },
];

export default function EscrowSteps() {
  return (
    <section id="how-escrow-works" className="landing-section landing-steps landing-anchor">
      <div className="landing-container">
        <div className="landing-section-heading">
          <p className="landing-overline">How escrow works</p>
          <h2>Four steps. Shared expectations.</h2>
        </div>
        <ol className="landing-steps-grid">
          {STEPS.map(({ number, title, body, Icon }) => (
            <li className="landing-step" key={number}>
              <span className="landing-step-icon"><Icon size={19} aria-hidden="true" /></span>
              <span className="landing-step-number">{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
