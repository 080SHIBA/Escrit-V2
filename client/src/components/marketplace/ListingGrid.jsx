import ListingCard from './ListingCard.jsx';

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
  if (loading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[14px]" aria-label="Loading listings" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="aspect-[4/3] animate-pulse bg-line/40" />
            <div className="space-y-3 p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-line/40" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-line/40" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-line/40" />
              <div className="h-10 animate-pulse rounded bg-line/40" />
            </div>
          </div>
        ))}
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[14px]">
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
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="min-h-11 rounded-lg border border-line-strong bg-surface px-6 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
