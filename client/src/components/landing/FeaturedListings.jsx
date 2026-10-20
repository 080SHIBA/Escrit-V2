import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import ListingDetailsDialog from './ListingDetailsDialog.jsx';

const TYPE_FILTERS = [
  ['all', 'All'],
  ['product', 'Products'],
  ['service', 'Services'],
  ['course', 'Courses'],
];
const money = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

function ListingTile({ listing, onOpen }) {
  const [imageFailed, setImageFailed] = useState(!listing.coverUrl);
  const typeName = listing.type === 'product' ? 'Product' : listing.type === 'service' ? 'Service' : 'Course';

  return (
    <article className="landing-listing-card">
      <div
        role="group"
        tabIndex={0}
        className="landing-listing-open"
        aria-label={`Listing: ${listing.title}`}
        onClick={(event) => { if (!event.target.closest('a')) onOpen(event); }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
            event.preventDefault();
            onOpen(event);
          }
        }}
      >
        <span className="landing-listing-image">
          {!imageFailed ? (
            <img src={listing.coverUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          ) : (
            <span className="landing-image-fallback" aria-hidden="true">{listing.title.trim().charAt(0).toLocaleUpperCase()}</span>
          )}
          <span className="landing-listing-type">{typeName}</span>
        </span>
        <span className="landing-listing-content">
          <span className="landing-listing-category">{listing.category}</span>
          <strong className="landing-listing-title">{listing.title}</strong>
          <span className="landing-listing-seller">
            {listing.sellerAvatarUrl ? (
              <img src={listing.sellerAvatarUrl} alt="" loading="lazy" />
            ) : (
              <span className="landing-seller-avatar landing-avatar-fallback" aria-hidden="true">
                {listing.sellerName.trim().charAt(0).toLocaleUpperCase()}
              </span>
            )}
            <Link to={`/marketplace/seller/${listing.sellerId}`} className="landing-listing-seller-name" onClick={(event) => event.stopPropagation()}>{listing.sellerName}</Link>
            {listing.sellerVerified && (
              <span className="landing-verified" title="Identity verified">
                <BadgeCheck size={15} aria-hidden="true" />
                <span>Verified</span>
              </span>
            )}
          </span>
          <span className="landing-listing-rating">
            {listing.ratingCount > 0 ? (
              <>
                <Star size={14} className="landing-star" aria-hidden="true" />
                {Number(listing.ratingAvg).toFixed(1)} <span>({listing.ratingCount})</span>
              </>
            ) : <span>No reviews yet</span>}
          </span>
          <span className="landing-listing-bottom">
            <strong>₦{money.format(Number(listing.price) || 0)}</strong>
            <span>{listing.paymentOptionLabel || 'Escrow optional'}</span>
          </span>
        </span>
      </div>
    </article>
  );
}

export default function FeaturedListings({ filters, listings, loading, error, isAuthed, onRetry, onClearFilters }) {
  const [selectedListing, setSelectedListing] = useState(null);
  const returnFocusRef = useRef(null);
  const { type, setType, filteredListings, hasActiveFilters } = filters;

  const openListing = (listing, event) => {
    returnFocusRef.current = event.currentTarget;
    setSelectedListing(listing);
  };

  useEffect(() => {
    if (!selectedListing && returnFocusRef.current) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [selectedListing]);

  const orderedListings = useMemo(
    () => [...filteredListings].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)),
    [filteredListings]
  );

  return (
    <section id="listings" className="landing-section landing-anchor">
      <div className="landing-container">
        <div className="landing-listings-heading">
          <div className="landing-section-heading">
            <p className="landing-overline">Featured listings</p>
            <h2>Worth a closer look.</h2>
            <p>Browse listings, then review the seller and transaction details before you decide.</p>
          </div>
          <div className="landing-filter-controls">
            <div className="landing-type-filters" role="group" aria-label="Filter listings by type">
              {TYPE_FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => setType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="landing-clear-filters" onClick={onClearFilters} disabled={!hasActiveFilters}>
              Clear filters
            </button>
          </div>
        </div>

        <p className="landing-result-count" aria-live="polite" aria-atomic="true">
          {loading ? 'Loading listings…' : `${orderedListings.length} ${orderedListings.length === 1 ? 'listing' : 'listings'}`}
        </p>

        {error && (
          <div className="landing-listing-error" role="alert">
            <p>{error}</p>
            <button type="button" className="landing-button landing-button-secondary" onClick={onRetry}>Retry</button>
          </div>
        )}
        {loading ? (
          <div className="landing-listing-grid" aria-label="Loading listings" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => <div className="landing-listing-skeleton" key={index} />)}
          </div>
        ) : orderedListings.length ? (
          <div className="landing-listing-grid">
            {orderedListings.map((listing) => (
              <ListingTile key={`${listing.type}-${listing.id}`} listing={listing} onOpen={(event) => openListing(listing, event)} />
            ))}
          </div>
        ) : (
          <div className="landing-empty-listings">
            <p>No listings match these filters.</p>
            <button type="button" className="landing-button landing-button-secondary" onClick={onClearFilters}>Show all listings</button>
          </div>
        )}
      </div>
      {selectedListing && (
        <ListingDetailsDialog
          listing={selectedListing}
          isAuthed={isAuthed}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </section>
  );
}
