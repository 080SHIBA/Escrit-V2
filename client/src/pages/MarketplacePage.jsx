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
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'newest';
  return {
    query: searchParams.get('q') || '',
    category: ['all', ...MARKETPLACE_CATEGORIES].includes(category) ? category : 'all',
    minRating: searchParams.get('minRating') === '4.5' ? '4.5' : '',
    sort: ['newest', 'price-low', 'price-high', 'top-rated'].includes(sort) ? sort : 'newest',
  };
}

const PAGE_CONTENT = {
  product: {
    title: 'Products',
    description: 'Shop useful finds from independent sellers. Check each listing for delivery, pickup, and payment options.',
    action: 'List a product',
  },
  service: {
    title: 'Services',
    description: 'Find skilled people for the work you need. Review the details and agree timing with the seller.',
    action: 'Offer a service',
  },
  course: {
    title: 'Courses',
    description: 'Explore practical courses from independent creators and choose the learning format that works for you.',
    action: 'Create a course',
  },
};

export default function MarketplacePage({ type = 'product' }) {
  const page = PAGE_CONTENT[type] || PAGE_CONTENT.product;
  usePageTitle(`${page.title} | Marketplace`);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const [queryInput, setQueryInput] = useState(filters.query);
  const [toast, setToast] = useState('');
  const { seller } = useAuthContext();
  const { listings, loading, loadingMore, error, hasMore, retry, loadMore } = useListings({ pageSize: 100 });
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
      type,
      category: filters.category,
      minRating: filters.minRating,
    });
    return sortListings(matching, filters.sort);
  }, [filters.category, filters.minRating, filters.query, filters.sort, listings, type]);

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
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">{page.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65 sm:text-base">
            {page.description} Escrow is optional by listing.
          </p>
        </div>
        <Link
          to="/account/storefront?tab=list"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {page.action}
        </Link>
      </header>

      <section aria-label={`Find ${page.title.toLowerCase()}`} className="market-filters mt-8 space-y-6">
        <TypeSwitch value={type} />
        <SearchBar
          query={queryInput}
          onQueryChange={setQueryInput}
          sort={filters.sort}
          onSortChange={(value) => updateFilter('sort', value)}
          listingLabel={page.title.toLowerCase()}
        />
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
