import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FilterChips from '../components/marketplace/FilterChips.jsx';
import ListingGrid from '../components/marketplace/ListingGrid.jsx';
import SearchBar from '../components/marketplace/SearchBar.jsx';
import TypeSwitch from '../components/marketplace/TypeSwitch.jsx';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { filterListings, filterServiceListings, MARKETPLACE_CATEGORIES_BY_TYPE, sortListings } from '../lib/marketplaceState.js';
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
    category,
    minRating: searchParams.get('minRating') === '4.5' ? '4.5' : '',
    sort: ['newest', 'price-low', 'price-high', 'top-rated'].includes(sort) ? sort : 'newest',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    serviceModel: ['appointment', 'fixed_scope', 'custom_quote'].includes(searchParams.get('serviceModel')) ? searchParams.get('serviceModel') : 'all',
    serviceLocation: ['remote', 'in-person', 'buyer-location'].includes(searchParams.get('serviceLocation')) ? searchParams.get('serviceLocation') : 'all',
    appointmentSchedule: searchParams.get('appointmentSchedule') === 'true',
    verifiedProviders: searchParams.get('verifiedProviders') === 'true',
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
    description: 'Book a scheduled service, order a defined package, or request a custom quote. Review each listing’s delivery and payment terms.',
    action: 'Create service',
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
  const { listings, loading, loadingMore, error, hasMore, retry, loadMore } = useListings({ pageSize: 24, type });
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

  const categories = useMemo(
    () => [...new Set([
      ...(MARKETPLACE_CATEGORIES_BY_TYPE[type] || MARKETPLACE_CATEGORIES_BY_TYPE.product),
      ...listings.map((listing) => listing.category).filter(Boolean),
    ])].sort(),
    [listings, type]
  );

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
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    });
    const serviceFiltered = type === 'service' ? filterServiceListings(matching, {
      model: filters.serviceModel,
      location: filters.serviceLocation,
      appointmentSchedule: filters.appointmentSchedule,
      verifiedProviders: filters.verifiedProviders,
    }) : matching;
    return sortListings(serviceFiltered, filters.sort);
  }, [filters, listings, type]);

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
          to={type === 'service' ? '/marketplace/new/service' : '/account/storefront?tab=list'}
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
          categories={categories}
        />
        {type === 'service' && (
          <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-ink/65">Service model
              <select value={filters.serviceModel} onChange={(event) => updateFilter('serviceModel', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-sm">
                <option value="all">All service models</option><option value="appointment">Appointment</option><option value="fixed_scope">Fixed scope</option><option value="custom_quote">Custom quote</option>
              </select>
            </label>
            <label className="text-xs text-ink/65">Location
              <select value={filters.serviceLocation} onChange={(event) => updateFilter('serviceLocation', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-sm">
                <option value="all">Any location</option><option value="remote">Remote</option><option value="in-person">In person</option><option value="buyer-location">At buyer location</option>
              </select>
            </label>
            <label className="text-xs text-ink/65">Minimum price (₦)
              <input type="number" min="0" value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-sm" placeholder="Any" />
            </label>
            <label className="text-xs text-ink/65">Maximum price (₦)
              <input type="number" min="0" value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-sm" placeholder="Any" />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink/65">
              <input type="checkbox" checked={filters.appointmentSchedule} onChange={(event) => updateFilter('appointmentSchedule', event.target.checked ? 'true' : '')} />
              Has published appointment hours
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink/65">
              <input type="checkbox" checked={filters.verifiedProviders} onChange={(event) => updateFilter('verifiedProviders', event.target.checked ? 'true' : '')} />
              Verified providers only
            </label>
          </div>
        )}
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
