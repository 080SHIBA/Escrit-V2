import { useState } from 'react';
import { BadgeCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import RatingStars from './RatingStars.jsx';

export default function ListingCard({
  listing,
  isOwn,
  isSaved,
  inCart,
  onOpen,
  onAddToCart,
  onToggleSaved,
}) {
  const [imageFailed, setImageFailed] = useState(!listing.coverUrl);
  const typeName = listing.type === 'product' ? 'Product' : listing.type === 'service' ? 'Service' : 'Course';

  function open(event) {
    if (event.target.closest('button, a')) return;
    onOpen(listing, event);
  }

  return (
    <article
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
          event.preventDefault();
          onOpen(listing, event);
        }
      }}
      className="group min-w-0 cursor-pointer overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-accent hover:shadow-card-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest-50 dark:bg-forest-900">
        {!imageFailed && (
          <img
            src={listing.coverUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        )}
        {imageFailed && (
          <div aria-hidden="true" className="flex h-full items-center justify-center bg-accent/10 text-5xl font-semibold text-accent">
            {listing.title.trim().charAt(0).toLocaleUpperCase()}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-line/70 bg-paper/90 px-2.5 py-1 text-xs font-medium text-ink">
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
        </div>
        <h2 className="min-h-11 font-display text-base leading-5">
          <button type="button" onClick={(event) => onOpen(listing, event)} className="line-clamp-2 text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {listing.title}
          </button>
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
          <p className="truncate text-base font-semibold">₦{Number(listing.price).toLocaleString('en-NG')}</p>
          <button
            type="button"
            disabled={isOwn || inCart}
            onClick={() => onAddToCart(listing)}
            className="min-h-11 shrink-0 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-paper-2 disabled:text-ink/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {isOwn ? 'Yours' : inCart ? 'In cart' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
