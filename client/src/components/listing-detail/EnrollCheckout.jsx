import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';

// WHAT: the checkout dialog for a COURSE. One item, one payment, access on success. No cart.
//
// WHY separate from the cart checkout: a course differs from a product in what the buyer must
// confirm. There is no delivery address and no escrow (nothing is shipped, and access is
// granted the moment payment clears), so the only checks are: whose account gets access, the
// total with fees, and an acknowledgement that access is instant and not held in escrow.
//
// Price and fees come from the server's review endpoint, never from the page, so the total
// shown is the amount that will actually be charged.
const money = (kobo) => `₦${(Number(kobo || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function EnrollCheckout({ listing, onClose, onToast }) {
  const { seller } = useAuthContext();
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [terms, setTerms] = useState(false);
  const [paying, setPaying] = useState(false);
  // WHY a key per dialog opening: the server uses it so a double tap or a retry after a slow
  // network can never charge twice for the same enrollment.
  const keyRef = useRef(`enroll-${listing.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const dialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    api.reviewInstant({ listingType: 'course', listingId: listing.id })
      .then((result) => { if (active) setReview(result); })
      .catch((cause) => { if (active) setError(cause?.message || 'We couldn’t prepare this checkout. Please try again.'); });
    return () => { active = false; };
  }, [listing.id]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !paying) onClose(); };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, paying]);

  async function pay() {
    setPaying(true);
    setError('');
    try {
      const result = await api.payInstant({ idempotencyKey: keyRef.current, termsAccepted: true, item: { listingType: 'course', listingId: listing.id } });
      if (result.authorizationUrl) { window.location.assign(result.authorizationUrl); return; }
      if (result.status === 'confirmed') { onToast?.('You’re enrolled.'); onClose(); return; }
      setError(result.errorMessage || 'This payment could not start. Please try again.');
    } catch (cause) {
      setError(cause?.message || 'This payment could not start. Please try again.');
    }
    setPaying(false);
  }

  const line = review?.orders?.[0];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget && !paying) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Enroll in ${listing.title}`} className="max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-card-lg outline-none sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg">Enroll in this course</h2>
          <button type="button" onClick={onClose} disabled={paying} aria-label="Close" className="-mr-2 -mt-2 min-h-11 min-w-11 rounded-full text-xl leading-none text-ink/60">×</button>
        </div>
        <p className="mt-1 text-sm font-medium">{listing.title}</p>

        {!review && !error && <p className="mt-4 text-sm text-ink/60" role="status">Preparing your checkout…</p>}

        {line && (
          <>
            <dl className="mt-4 space-y-2 rounded-xl border border-line bg-paper-2 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink/65">Course</dt><dd>{money(line.amountKobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/65">Processing fee</dt><dd>{money(line.processingFeeKobo)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd>{money(review.totalKobo)}</dd></div>
            </dl>
            <div className="mt-3 rounded-xl border border-line p-3 text-sm">
              <p className="text-ink/65">Access will be added to</p>
              <p className="mt-0.5 font-medium">{seller?.email || 'your Escrit account'}</p>
            </div>
            <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-5">
              <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 h-5 w-5 accent-ink" />
              <span>I understand that access is granted immediately after payment and that course purchases are not held in escrow.</span>
            </label>
          </>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}
        <button type="button" onClick={pay} disabled={!line || !terms || paying} className="mt-4 min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          {paying ? 'Opening secure payment…' : line ? `Pay ${money(review.totalKobo)} and enroll` : 'Enroll'}
        </button>
      </div>
    </div>
  );
}
