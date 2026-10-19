import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import RatingStars from './RatingStars.jsx';

export default function ListingModal({
  listing,
  isOwn,
  isSaved,
  inCart,
  sellerId,
  onClose,
  onAddToCart,
  onToggleSaved,
  onRatingUpdated,
}) {
  const dialogRef = useRef(null);
  const ratingRef = useRef(null);
  const [eligible, setEligible] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [ratingError, setRatingError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.showModal();
    dialog.querySelector('[data-dialog-close]')?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!sellerId || isOwn) return undefined;
    setCheckingEligibility(true);
    api.getReviewEligibility(listing.type, listing.id, sellerId)
      .then(({ eligible: canRate }) => { if (active) setEligible(Boolean(canRate)); })
      .catch(() => { if (active) setEligible(false); })
      .finally(() => { if (active) setCheckingEligibility(false); });
    return () => { active = false; };
  }, [isOwn, listing.id, listing.type, sellerId]);

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submitRating(event) {
    event.preventDefault();
    setRatingError('');
    setSubmitting(true);
    try {
      const result = await api.createListingReview(listing.type, listing.id, { rating: Number(rating), comment: comment.trim() }, sellerId);
      onRatingUpdated(listing.id, { ratingAvg: result.ratingAvg, ratingCount: result.ratingCount });
      setEligible(false);
      setComment('');
      ratingRef.current?.focus();
    } catch {
      setRatingError('We couldn’t submit your rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const typeName = listing.type === 'product' ? 'Product' : listing.type === 'service' ? 'Service' : 'Course';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="listing-modal-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        trapFocus(event);
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="max-h-[min(90vh,54rem)] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-line bg-paper p-0 text-ink shadow-card-lg backdrop:bg-ink/55"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-7">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">{typeName}</span>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-ink/65">{listing.category}</span>
        </div>
        <button
          data-dialog-close
          type="button"
          onClick={onClose}
          aria-label="Close listing details"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-6 p-5 sm:p-7">
        <div>
          <h2 id="listing-modal-title" className="font-display text-2xl leading-tight sm:text-3xl">{listing.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <RatingStars ratingAvg={listing.ratingAvg} ratingCount={listing.ratingCount} />
            {listing.ratingCount > 0 && <span className="text-xs text-ink/50">from completed escrow orders</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4">
          <div className="flex items-center gap-2 text-sm text-ink/70">
            <Link to={`/marketplace/seller/${listing.sellerId || sellerId}`} onClick={onClose} className="hover:underline">{listing.sellerName}</Link>
            {listing.sellerVerified && <span className="inline-flex items-center gap-1 text-released"><BadgeCheck size={16} aria-hidden="true" /> Verified</span>}
          </div>
          <p className="text-xl font-semibold">₦{Number(listing.price).toLocaleString('en-NG')}</p>
        </div>
        <section aria-labelledby="escrow-heading" className="rounded-xl border border-released/30 bg-released-soft p-4 sm:p-5">
          <h3 id="escrow-heading" className="font-semibold">How escrow protects you</h3>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-ink/75">
            <li><span className="font-semibold">1. You pay.</span> Escrit holds the money.</li>
            <li><span className="font-semibold">2. The seller delivers.</span></li>
            <li><span className="font-semibold">3. You confirm.</span> The seller gets paid.</li>
          </ol>
          <p className="mt-3 border-t border-released/20 pt-3 text-sm font-medium text-released">Not happy? Raise a dispute.</p>
        </section>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isOwn || inCart}
            onClick={() => onAddToCart(listing)}
            className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-paper-2 disabled:text-ink/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {isOwn ? 'Yours' : inCart ? 'In cart' : 'Add to cart'}
          </button>
          <button
            type="button"
            aria-pressed={isSaved}
            onClick={() => onToggleSaved(listing)}
            className="min-h-11 rounded-lg border border-line px-5 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
        {checkingEligibility && <p className="text-xs text-ink/55">Checking rating eligibility…</p>}
        {eligible && (
          <form onSubmit={submitRating} className="space-y-3 border-t border-line pt-5">
            <h3 className="font-semibold">Rate this listing</h3>
            <p className="text-sm text-ink/65">Only buyers with a released escrow order can leave a rating.</p>
            {ratingError && <p role="alert" className="text-sm text-dispute">{ratingError}</p>}
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <label className="text-sm font-medium">
                Rating
                <select ref={ratingRef} value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 h-11 w-full bg-input px-3 text-base">
                  {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} {score === 1 ? 'star' : 'stars'}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">
                Comment (optional)
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full resize-y bg-input p-3 text-base" />
              </label>
            </div>
            <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              {submitting ? 'Submitting…' : 'Submit rating'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
