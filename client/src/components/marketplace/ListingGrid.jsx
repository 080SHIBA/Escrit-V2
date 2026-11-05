import ListingCard from './ListingCard.jsx';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll.js';

// WHAT: the one grid layout used by the skeleton and the real list.
// WHY many columns: shoppers asked to compare as many products as possible at a glance. Columns grow
// with the screen: 2 on phones (3 would make cards too narrow to tap), 3 on large phones/small tablets,
// then 4, 5 and 6 on laptops and wide monitors. Cards are compact (see ListingCard) so every detail
// still fits, and anyone wanting more opens the listing.
const GRID_CLASSES = 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

// WHAT: skeleton cards shown while the first page loads.
// WHY 12: two full rows on the widest grid, enough to fill the first screen.
const SKELETON_COUNT = 12;

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="aspect-[5/4] animate-pulse bg-line/40" />
      <div className="space-y-2 p-2 sm:p-2.5">
        <div className="h-3 w-24 animate-pulse rounded bg-line/40" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-line/40" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-line/40" />
        <div className="h-8 animate-pulse rounded bg-line/40" />
      </div>
    </div>
  );
}

export default function ListingGrid({
  listings,
  loading,
  error,
  hasMore,
  loadingMore,
  onRetry,
  onLoadMore,
  isOwnListing,
  savedIds,
  cartIds,
  onAddToCart,
  onToggleSaved,
}) {
  // WHAT: auto-load the next page when the visitor nears the bottom.
  // WHY: replaces the old "Load more" button, which interrupted browsing after
  // only a short scroll. Disabled while loading, when there is nothing left, and
  // after an error (so a failing request is not retried in a loop; the visitor
  // gets a Retry button instead).
  const sentinelRef = useInfiniteScroll({
    onLoadMore,
    enabled: Boolean(hasMore && !loading && !loadingMore && !error),
  });

  if (loading) {
    return (
      <div className={GRID_CLASSES} aria-label="Loading listings" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => <SkeletonCard key={index} />)}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dispute/30 bg-dispute-soft p-4 text-sm text-ink">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-line px-4 font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            Retry
          </button>
        </div>
      )}
      {!listings.length ? (
        <p className="rounded-xl border border-dashed border-line-strong px-5 py-14 text-center text-sm text-ink/65">
          No listings match. Try another search or category.
        </p>
      ) : (
        <div className={GRID_CLASSES}>
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isOwn={isOwnListing(listing)}
              isSaved={savedIds.has(listing.id)}
              inCart={cartIds.has(listing.id)}
              onAddToCart={onAddToCart}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </div>
      )}
      {/* WHAT: skeleton row shown while the next page is being fetched.
          WHY: tells the visitor more is coming, so the end of the list never looks like a dead end. */}
      {loadingMore && (
        <div className={`${GRID_CLASSES} mt-2.5`} aria-busy="true" aria-label="Loading more listings">
          {Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} />)}
        </div>
      )}

      {/* WHAT: invisible marker the observer watches (see useInfiniteScroll).
          WHY it stays rendered only while more pages exist: no marker, no extra requests. */}
      {hasMore && !loadingMore && !error && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

      {/* WHAT: manual fallback button, shown only if auto-loading cannot work.
          WHY: (a) a page failed to load, so we stop auto-retrying and let the visitor decide;
          (b) an old browser without IntersectionObserver would otherwise be stuck. */}
      {hasMore && !loadingMore && (error || typeof IntersectionObserver === 'undefined') && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="min-h-11 rounded-lg border border-line-strong bg-surface px-6 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            Load more listings
          </button>
        </div>
      )}

      {/* WHAT: end-of-list message. WHY: confirms that scrolling stopped because there is nothing else, not because loading broke. */}
      {!hasMore && listings.length > 0 && !error && (
        <p className="mt-8 text-center text-xs text-ink/50">You’ve reached the end of the listings.</p>
      )}
    </div>
  );
}
