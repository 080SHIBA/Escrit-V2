import { useState } from 'react';
import { Check, Copy, Link2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EscrowSection({ isAuthed }) {
  const [copyState, setCopyState] = useState('idle');
  const createLinkUrl = `${window.location.origin}${isAuthed ? '/dashboard/new' : '/login?next=%2Fdashboard%2Fnew'}`;

  async function copyCreateLink() {
    try {
      await navigator.clipboard.writeText(createLinkUrl);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <section id="escrow" className="landing-section landing-escrow landing-anchor">
      <div className="landing-container landing-escrow-grid">
        <div className="landing-escrow-copy">
          <p className="landing-overline">Escrow beyond the marketplace</p>
          <h2>A safer way to handle deals beyond the marketplace.</h2>
          <p>
            Agree on the transaction terms, create an Escrit escrow link, and share it with the other party. They can review the details before creating an account to participate.
          </p>
          <ul className="landing-check-list">
            <li><Check size={18} aria-hidden="true" /> Create and share a link</li>
            <li><Check size={18} aria-hidden="true" /> Both parties access the transaction through Escrit</li>
            <li><Check size={18} aria-hidden="true" /> Track completion and applicable dispute steps</li>
          </ul>
          <Link
            to={isAuthed ? '/dashboard/new' : '/login?next=%2Fdashboard%2Fnew'}
            className="landing-button landing-button-primary"
          >
            Create and share a link
          </Link>
        </div>

        <article className="landing-example-card" aria-label="Example escrow link details">
          <div className="landing-example-heading">
            <span className="landing-example-icon"><Link2 size={18} aria-hidden="true" /></span>
            <div>
              <p>LINK PREVIEW</p>
              <h3>Terms, clear before payment.</h3>
            </div>
          </div>
          <dl className="landing-example-details">
            <div><dt>Item or service</dt><dd>Agreed between both parties</dd></div>
            <div><dt>Price</dt><dd>₦ Set by you</dd></div>
            <div><dt>Seller</dt><dd><ShieldCheck size={15} aria-hidden="true" /> Verified before payment</dd></div>
            <div><dt>Delivery</dt><dd>Terms agreed in the link</dd></div>
            <div><dt>Release rule</dt><dd>72 hours after delivery</dd></div>
          </dl>
          <p className="landing-example-note">A real transaction link is created after you agree on the details and sign in.</p>
          <button type="button" className="landing-copy-link" onClick={copyCreateLink}>
            {copyState === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            Copy link
          </button>
          <p className="landing-copy-status" role="status" aria-live="polite">
            {copyState === 'copied' ? 'Link copied.' : copyState === 'error' ? 'Could not copy. Please use Create and share a link.' : ''}
          </p>
        </article>
      </div>
    </section>
  );
}
