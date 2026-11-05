import { useState } from 'react';
import { BadgeCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import RatingStars from './RatingStars.jsx';
import { getMarketplaceCardAction } from '../../lib/marketplaceState.js';
import { prefetchListingDetail } from '../../hooks/useListingDetail.js';

export default function ListingCard({
  listing,
  isOwn,
  isSaved,
  inCart,
  onAddToCart,
  onToggleSaved,
}) {
  const [imageFailed, setImageFailed] = useState(!listing.coverUrl);
  const typeName = listing.type === 'product' ? 'Product' : listing.type === 'service' ? 'Service' : 'Course';
  const cardAction = getMarketplaceCardAction(listing);
  const detailPath = `/listing/${encodeURIComponent(listing.id)}`;
  const serviceModelName = {
    appointment: 'Appointment',
    fixed_scope: 'Fixed scope',
    custom_quote: 'Custom quote',
  }[listing.serviceModel] || 'Service';
  const listedLocations = [...new Set((listing.deliveryMethods || []).map((method) => ({
    online: 'Remote',
    remote_deliverable: 'Remote',
    provider_location: 'At provider location',
    buyer_location: 'At buyer location',
  })[method]).filter(Boolean))];
  const serviceLocations = listedLocations.length ? listedLocations : [{
    remote: 'Remote',
    'in-person': 'In person',
    hybrid: 'Remote / in person',
  }[listing.deliveryMode]].filter(Boolean);
  const serviceTiming = listing.serviceModel === 'appointment'
    ? listing.durationMinutes ? `${listing.durationMinutes} min` : ''
    : listing.estimatedTime || listing.deliveryTime || '';
  const verificationLabel = listing.sellerVerified
    ? 'Verified'
    : listing.sellerVerificationStatus === 'pending' ? 'Verification pending' : 'Not verified';

  return (
    <article
      className="group min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-accent hover:shadow-card-md motion-reduce:transition-none"
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-forest-50 dark:bg-forest-900">
        <Link to={detailPath} onPointerEnter={() => prefetchListingDetail(listing.id)} onTouchStart={() => prefetchListingDetail(listing.id)} aria-label={`View ${listing.title}`} className="absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          {!imageFailed ? (
            <img src={listing.coverUrl} alt={listing.title} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
          ) : (
            <span aria-hidden="true" className="flex h-full items-center justify-center bg-accent/10 text-5xl font-semibold text-accent">{listing.title.trim().charAt(0).toLocaleUpperCase()}</span>
          )}
        </Link>
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full border border-line/70 bg-paper/90 px-2 py-0.5 text-[10px] font-medium text-ink">
          {typeName}
        </span>
        <button
          type="button"
          aria-label={isSaved ? `Remove ${listing.title} from saved listings` : `Save ${listing.title}`}
          aria-pressed={isSaved}
          onClick={() => onToggleSaved(listing)}
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-card hover:border-accent hover:text-dispute focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Heart size={16} aria-hidden="true" className={isSaved ? 'fill-dispute text-dispute' : ''} />
        </button>
      </div>
      {/* WHY tight spacing: with up to 6 columns the cards are narrow, so small padding and type keep every detail visible without growing taller. */}
      <div className="space-y-1.5 p-2 sm:p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-medium text-ink/55">{listing.category}</span>
          <span className="shrink-0 text-[9px] font-medium text-ink/55">{listing.paymentOptionLabel || 'Payment options vary'}</span>
        </div>
        <h2 className="min-h-8 font-display text-[13px] leading-4">
          <Link to={`/listing/${encodeURIComponent(listing.id)}`} className="line-clamp-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {listing.title}
          </Link>
        </h2>
        <RatingStars ratingAvg={listing.ratingAvg} ratingCount={listing.ratingCount} />
        <div className="flex min-h-4 items-center gap-1 text-[11px] text-ink/65">
          <Link to={`/marketplace/seller/${listing.sellerId}`} onClick={(event) => event.stopPropagation()} className="truncate hover:text-accent hover:underline">{listing.sellerName}</Link>
          {listing.sellerVerified && (
            <span className="inline-flex shrink-0 items-center gap-1 text-released" title="Verified seller">
              <BadgeCheck size={14} aria-hidden="true" /> <span>Verified</span>
            </span>
          )}
          {listing.type === 'service' && !listing.sellerVerified && <span className="shrink-0 text-ink/50">{verificationLabel}</span>}
        </div>
        {listing.type === 'service' && (
          <div className="space-y-0.5 text-[10px] text-ink/55">
            <p>{serviceModelName}{serviceLocations.length ? ` · ${serviceLocations.join(' / ')}` : ''}</p>
            {serviceTiming && <p>{serviceTiming}</p>}
          </div>
        )}
        <div className="flex items-center justify-between gap-1.5 border-t border-line pt-2">
          <p className="truncate text-sm font-semibold">
            {cardAction === 'request-quote'
              ? Number(listing.startingPrice) > 0 ? `From ₦${Number(listing.startingPrice).toLocaleString('en-NG')}` : 'Get a quote'
              : `₦${Number(listing.price).toLocaleString('en-NG')}`}
          </p>
          {cardAction === 'cart' ? (
            <button
              type="button"
              disabled={isOwn || inCart}
              onClick={() => onAddToCart(listing)}
              className="min-h-9 shrink-0 rounded-md bg-accent px-2.5 text-xs font-semibold text-accent-ink hover:bg-accent/90 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-paper-2 disabled:text-ink/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {isOwn ? 'Yours' : inCart ? 'In cart' : 'Add to cart'}
            </button>
          ) : isOwn ? (
            <button
              type="button"
              disabled
              className="min-h-9 shrink-0 rounded-md border border-line bg-paper-2 px-2.5 text-xs font-semibold text-ink/50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              Yours
            </button>
          ) : (
            <Link
              to={cardAction === 'enroll' ? `${detailPath}?enroll=1` : detailPath}
              className="inline-flex min-h-9 shrink-0 items-center rounded-md bg-accent px-2.5 text-xs font-semibold text-accent-ink hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {cardAction === 'request-quote' ? 'Request a quote' : cardAction === 'enroll' ? 'Enroll' : 'Book now'}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
