import { useState } from 'react';
import { BadgeCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import RatingStars from './RatingStars.jsx';
import { getMarketplaceCardAction } from '../../lib/marketplaceState.js';

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

  return (
    <article
      className="group min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-accent hover:shadow-card-md motion-reduce:transition-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest-50 dark:bg-forest-900">
        <Link to={detailPath} aria-label={`View ${listing.title}`} className="absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          {!imageFailed ? (
            <img src={listing.coverUrl} alt={listing.title} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
          ) : (
            <span aria-hidden="true" className="flex h-full items-center justify-center bg-accent/10 text-5xl font-semibold text-accent">{listing.title.trim().charAt(0).toLocaleUpperCase()}</span>
          )}
        </Link>
        <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-line/70 bg-paper/90 px-2.5 py-1 text-xs font-medium text-ink">
          {typeName}
        </span>
        <button
          type="button"
          aria-label={isSaved ? `Remove ${listing.title} from saved listings` : `Save ${listing.title}`}
          aria-pressed={isSaved}
          onClick={() => onToggleSaved(listing)}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-card hover:border-accent hover:text-dispute focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Heart size={19} aria-hidden="true" className={isSaved ? 'fill-dispute text-dispute' : ''} />
        </button>
      </div>
      <div className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-ink/55">{listing.category}</span>
          <span className="shrink-0 text-[10px] font-medium text-ink/55">{listing.paymentOptionLabel || 'Payment options vary'}</span>
        </div>
        <h2 className="min-h-11 font-display text-base leading-5">
          <Link to={`/listing/${encodeURIComponent(listing.id)}`} className="line-clamp-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {listing.title}
          </Link>
        </h2>
        <RatingStars ratingAvg={listing.ratingAvg} ratingCount={listing.ratingCount} />
        <div className="flex min-h-5 items-center gap-1.5 text-xs text-ink/65">
          <Link to={`/marketplace/seller/${listing.sellerId}`} onClick={(event) => event.stopPropagation()} className="truncate hover:text-accent hover:underline">{listing.sellerName}</Link>
          {listing.sellerVerified && (
            <span className="inline-flex shrink-0 items-center gap-1 text-released" title="Verified seller">
              <BadgeCheck size={14} aria-hidden="true" /> <span>Verified</span>
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <p className="truncate text-base font-semibold">
            {cardAction === 'request-quote' ? 'Get a quote' : `₦${Number(listing.price).toLocaleString('en-NG')}`}
          </p>
          {cardAction === 'cart' ? (
            <button
              type="button"
              disabled={isOwn || inCart}
              onClick={() => onAddToCart(listing)}
              className="min-h-11 shrink-0 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-paper-2 disabled:text-ink/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {isOwn ? 'Yours' : inCart ? 'In cart' : 'Add to cart'}
            </button>
          ) : isOwn ? (
            <button
              type="button"
              disabled
              className="min-h-11 shrink-0 rounded-lg border border-line bg-paper-2 px-3 text-sm font-semibold text-ink/50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              Yours
            </button>
          ) : (
            <Link
              to={detailPath}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {cardAction === 'request-quote' ? 'Request a quote' : 'Book now'}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
