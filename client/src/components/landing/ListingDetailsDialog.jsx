import { useEffect, useId, useRef } from 'react';
import { BadgeCheck, Star, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const money = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

export default function ListingDetailsDialog({ listing, onClose, isAuthed }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const listingPath = `/marketplace/${listing.type}/${listing.id}`;
  const signInPath = `/login?next=${encodeURIComponent(listingPath)}`;
  const identityVerified = Boolean(listing.sellerVerified);
  const sellerRating = Number(listing.sellerRatingAvg || listing.ratingAvg || 0);
  const sellerReviewCount = Number(listing.sellerReviewCount || listing.ratingCount || 0);
  const paymentOptions = listing.paymentOptions || { escrow: true, direct: true };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.showModal();
    dialog.querySelector('[data-dialog-close]')?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href]')];
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

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      className="landing-listing-dialog"
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
    >
      <div className="landing-dialog-header">
        <div>
          <p className="landing-overline">{listing.type}</p>
          <h2 id={titleId}>{listing.title}</h2>
        </div>
        <button
          data-dialog-close
          type="button"
          className="landing-icon-button"
          aria-label="Close listing details"
          onClick={onClose}
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="landing-dialog-body">
        <div className="landing-seller-profile">
          {listing.sellerAvatarUrl ? (
            <img className="landing-seller-avatar" src={listing.sellerAvatarUrl} alt="" />
          ) : (
            <span className="landing-seller-avatar landing-avatar-fallback" aria-hidden="true">
              {listing.sellerName.trim().charAt(0).toLocaleUpperCase()}
            </span>
          )}
          <div className="landing-seller-details">
            <Link to={`/marketplace/seller/${listing.sellerId}`} onClick={onClose} className="font-semibold hover:underline">{listing.sellerName}</Link>
            <span className={identityVerified ? 'landing-verified' : 'landing-unverified'}>
              {identityVerified && <BadgeCheck size={16} aria-hidden="true" />}
              {identityVerified ? 'Identity verified' : 'Identity verification not confirmed'}
            </span>
            <span className="landing-seller-rating">
              {sellerReviewCount > 0 ? (
                <>
                  <Star size={14} className="landing-star" aria-hidden="true" />
                  {sellerRating.toFixed(1)} · {sellerReviewCount} {sellerReviewCount === 1 ? 'review' : 'reviews'} from completed orders
                </>
              ) : 'No completed-order reviews yet'}
            </span>
          </div>
        </div>

        <section className="landing-protection-box" aria-labelledby="landing-protection-title">
          <h3 id="landing-protection-title">{listing.paymentOptionLabel || 'Escrow optional'}</h3>
          <p>{paymentOptions.escrow && paymentOptions.direct
            ? 'Choose escrow or pay without escrow on the listing page.'
            : paymentOptions.escrow
              ? 'This listing accepts escrow payment only.'
              : 'This listing accepts payment without escrow only. Escrit cannot hold or recover the money, but you can still report problems.'}</p>
        </section>

        <div className="landing-dialog-purchase">
          <p>₦{money.format(Number(listing.price) || 0)}</p>
          <Link to={isAuthed ? listingPath : signInPath} className="landing-button landing-button-primary">
            View payment options
          </Link>
        </div>
      </div>
    </dialog>
  );
}
