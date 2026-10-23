import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FilterChips from '../components/marketplace/FilterChips.jsx';
import ListingGrid from '../components/marketplace/ListingGrid.jsx';
import SearchBar from '../components/marketplace/SearchBar.jsx';
import TypeSwitch from '../components/marketplace/TypeSwitch.jsx';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { filterListings, MARKETPLACE_CATEGORIES, sortListings } from '../lib/marketplaceState.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import { getDefaultPaymentOption } from '../lib/listingDetailState.js';
import { useCart } from '../hooks/useCart.js';
import { useListings } from '../hooks/useListings.js';
import { useSaved } from '../hooks/useSaved.js';

function readFilters(searchParams) {
  const type = searchParams.get('type') || 'all';
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'newest';
  return {
    query: searchParams.get('q') || '',
    type: ['all', 'product', 'service', 'course'].includes(type) ? type : 'all',
    category: ['all', ...MARKETPLACE_CATEGORIES].includes(category) ? category : 'all',
    minRating: searchParams.get('minRating') === '4.5' ? '4.5' : '',
    sort: ['newest', 'price-low', 'price-high', 'top-rated'].includes(sort) ? sort : 'newest',
  };
}

export default function MarketplacePage() {
  usePageTitle('Marketplace');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const [queryInput, setQueryInput] = useState(filters.query);
  const [toast, setToast] = useState('');
  const { seller } = useAuthContext();
  const { listings, loading, loadingMore, error, hasMore, retry, loadMore } = useListings();
  const { cartIds, addToCart } = useCart();
  const { savedIds, toggleSaved } = useSaved();
  const ownSellerId = seller?._id || seller?.id || seller?.sellerId || '';

  useEffect(() => {
    setQueryInput(filters.query);
  }, [filters.query]);

  useEffect(() => {
    const normalizedQuery = queryInput.trim();
    if (normalizedQuery === filters.query) return undefined;
    const timeout = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (normalizedQuery) next.set('q', normalizedQuery);
        else next.delete('q');
        return next;
      }, { replace: true });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [filters.query, queryInput, setSearchParams]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function updateFilter(name, value) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === 'all' || (name === 'sort' && value === 'newest')) next.delete(name);
      else next.set(name, value);
      return next;
    }, { replace: true });
  }

  function isOwnListing(listing) {
    return Boolean(ownSellerId && listing.sellerId === ownSellerId);
  }

  async function handleAddToCart(listing) {
    if (isOwnListing(listing)) return;
    try {
      await addToCart(listing, {
        paymentOption: getDefaultPaymentOption(listing.paymentOptions),
        fulfilment: listing.type === 'product' ? listing.fulfillmentMethod || '' : '',
        quantity: 1,
      });
      setToast(`${listing.title} added to cart.`);
    } catch {
      setToast('We couldn’t add this listing to your cart. Please try again.');
    }
  }

  async function handleToggleSaved(listing) {
    try {
      const saved = await toggleSaved(listing);
      setToast(saved ? `${listing.title} saved for later.` : 'Listing removed from saved listings.');
    } catch {
      setToast('We couldn’t update your saved listings. Please try again.');
    }
  }

  const visibleListings = useMemo(() => {
    const matching = filterListings(listings, {
      q: filters.query,
      type: filters.type,
      category: filters.category,
      minRating: filters.minRating,
    });
    return sortListings(matching, filters.sort);
  }, [filters.category, filters.minRating, filters.query, filters.sort, filters.type, listings]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          {seller && (
            <p className="mb-2 text-sm font-semibold text-accent">
              Welcome back, {seller.fullName || seller.displayName || seller.businessName || seller.email}.
            </p>
          )}
          <p className="eyebrow">ESCRIT MARKETPLACE</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Marketplace</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65 sm:text-base">
            Browse listings and check each listing for its available payment options. Escrow is optional.
          </p>
        </div>
        <Link
          to="/account/storefront?tab=list"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          List product
        </Link>
      </header>

      <section aria-label="Find listings" className="market-filters mt-7 space-y-4">
        <SearchBar query={queryInput} onQueryChange={setQueryInput} sort={filters.sort} onSortChange={(value) => updateFilter('sort', value)} />
        <TypeSwitch value={filters.type} onChange={(value) => updateFilter('type', value)} />
        <FilterChips
          minRating={filters.minRating}
          onRatingChange={(value) => updateFilter('minRating', value)}
          category={filters.category}
          onCategoryChange={(value) => updateFilter('category', value)}
        />
      </section>

      <div className="my-5 flex min-h-6 items-center justify-between border-t border-line pt-4 text-sm text-ink/60">
        <p aria-live="polite" aria-atomic="true">
          {loading ? 'Loading listings…' : `${visibleListings.length} ${visibleListings.length === 1 ? 'listing' : 'listings'}${hasMore ? ' shown' : ''}`}
        </p>
        <span className="hidden text-xs text-ink/45 sm:inline">Payment options vary by listing</span>
      </div>

      <ListingGrid
        listings={visibleListings}
        loading={loading}
        error={error}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onRetry={retry}
        onLoadMore={loadMore}
        isOwnListing={isOwnListing}
        savedIds={savedIds}
        cartIds={cartIds}
        onAddToCart={handleAddToCart}
        onToggleSaved={handleToggleSaved}
      />

      {toast && <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink shadow-card-lg">{toast}</div>}
    </div>
  );
}
