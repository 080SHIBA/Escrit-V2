import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { CartIcon, HeartIcon } from '../components/icons.jsx';
import FeaturedCarousel from '../components/FeaturedCarousel.jsx';

const TYPES = [
  { key: 'product', label: 'Products' },
  { key: 'course', label: 'Courses' },
  { key: 'service', label: 'Services' },
];

const FALLBACK_IMAGES = {
  product: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
  course: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
  service: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
};

export default function Marketplace() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status: authStatus } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get('type');
  const [type, setType] = useState(TYPES.some((option) => option.key === requestedType) ? requestedType : 'product');
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [negotiableOnly, setNegotiableOnly] = useState(false);
  const [serviceModelFilter, setServiceModelFilter] = useState('all');
  const [serviceDeliveryFilter, setServiceDeliveryFilter] = useState('all');
  const [appointmentScheduleFilter, setAppointmentScheduleFilter] = useState(false);
  const [verifiedProvidersOnly, setVerifiedProvidersOnly] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [actionMessage, setActionMessage] = useState('');
  const [quickViewId, setQuickViewId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api
      .getMarketplace(type)
      .then((data) => {
        if (active) setItems(data.items || []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load this market right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    let active = true;
    if (authStatus !== 'authed') {
      setFavoriteIds(new Set());
      return undefined;
    }
    api.getFavorites().then(({ items: favorites }) => {
      if (active) setFavoriteIds(new Set(favorites.map((entry) => `${entry.listingType}:${entry.listing._id}`)));
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [authStatus]);

  useEffect(() => {
    setDisplayLimit(24);
  }, [type, query, category, sort, minPrice, maxPrice, minRating, negotiableOnly, serviceModelFilter, serviceDeliveryFilter, appointmentScheduleFilter, verifiedProvidersOnly]);

  function requireBuyerAccount() {
    if (authStatus === 'authed') return true;
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?intent=buyer&next=${next}`);
    return false;
  }

  async function addToCart(item) {
    if (type === 'service') return;
    if (type !== 'product') return;
    if (!requireBuyerAccount()) return;
    try {
      await api.addCartItem(type, item._id);
      setActionMessage(`${item.title} added to your cart.`);
    } catch (err) {
      setError(err.message || 'Unable to add this listing to your cart.');
    }
  }

  async function toggleFavorite(item) {
    if (!requireBuyerAccount()) return;
    const key = `${type}:${item._id}`;
    try {
      if (favoriteIds.has(key)) {
        await api.removeFavorite(type, item._id);
        setFavoriteIds((current) => {
          const updated = new Set(current);
          updated.delete(key);
          return updated;
        });
        setActionMessage('Listing removed from saved items.');
      } else {
        await api.addFavorite(type, item._id);
        setFavoriteIds((current) => new Set(current).add(key));
        setActionMessage(`${item.title} saved for later.`);
      }
    } catch (err) {
      setError(err.message || 'Unable to update saved listings.');
    }
  }

  const summary = useMemo(
    () => (
      items.length === 0
        ? 'No live listings yet.'
        : `${items.length} listing${items.length === 1 ? '' : 's'} live in this category.`
    ),
    [items.length]
  );

  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => !normalizedQuery || `${item.title} ${item.description} ${item.category} ${item.subcategory || ''} ${item.serviceModel || ''} ${item.seller?.businessName}`.toLowerCase().includes(normalizedQuery))
      .filter((item) => {
        const servicePrice = item.startingPrice || item.basePrice || 0;
        const priceKobo = Number(type === 'service' ? servicePrice : item.price || 0) * 100;
        return (!minPrice || priceKobo >= Number(minPrice) * 100) && (!maxPrice || priceKobo <= Number(maxPrice) * 100);
      })
      .filter((item) => Number(item.averageRating || 0) >= Number(minRating))
      .filter((item) => !negotiableOnly || Boolean(item.negotiable))
      .filter((item) => type !== 'service' || serviceModelFilter === 'all' || (item.serviceModel || 'appointment') === serviceModelFilter)
      .filter((item) => type !== 'service' || serviceDeliveryFilter === 'all' || (
        serviceDeliveryFilter === 'remote' ? item.deliveryMode === 'remote'
          : serviceDeliveryFilter === 'in-person' ? ['in-person', 'hybrid'].includes(item.deliveryMode)
            : (item.deliveryMethods || []).includes('buyer_location')
      ))
      .filter((item) => type !== 'service' || !appointmentScheduleFilter || (
        (item.serviceModel || 'appointment') === 'appointment' && (item.availability || []).length > 0
      ))
      .filter((item) => type !== 'service' || !verifiedProvidersOnly || Boolean(item.sellerVerified || item.seller?.isVerified))
      .sort((left, right) => {
        if (sort === 'newest') {
          const now = Date.now();
          const leftBoosted = left.promotionUntil && new Date(left.promotionUntil).getTime() > now;
          const rightBoosted = right.promotionUntil && new Date(right.promotionUntil).getTime() > now;
          if (Boolean(left.isFeatured) !== Boolean(right.isFeatured)) return Number(right.isFeatured) - Number(left.isFeatured);
          if (Boolean(leftBoosted) !== Boolean(rightBoosted)) return Number(rightBoosted) - Number(leftBoosted);
        }
        const leftPrice = Number(type === 'service' ? left.startingPrice || left.basePrice : left.price || 0) * 100;
        const rightPrice = Number(type === 'service' ? right.startingPrice || right.basePrice : right.price || 0) * 100;
        if (sort === 'price-low') return leftPrice - rightPrice;
        if (sort === 'price-high') return rightPrice - leftPrice;
        if (sort === 'popular') return Number(right.reviewCount || 0) - Number(left.reviewCount || 0);
        return new Date(right.createdAt) - new Date(left.createdAt);
      });
  }, [items, query, category, sort, type, minPrice, maxPrice, minRating, negotiableOnly, serviceModelFilter, serviceDeliveryFilter, appointmentScheduleFilter, verifiedProvidersOnly]);

  const displayedItems = visibleItems.slice(0, displayLimit);

  return (
    <div className="marketplace-page mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">ESCRIT MARKETPLACE</p>
          <h1 className="mt-2 font-display text-3xl sm:text-5xl">Compare before you commit.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65 sm:text-base">Shop products, discover courses, and compare services from independent sellers. Each listing shows whether escrow, direct payment, or both are available.</p>
        </div>
        <Link
          to={`/marketplace/new/${type}`}
          className="inline-flex items-center justify-center rounded-lg border border-ink bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          List {type}
        </Link>
      </div>

      {location.state?.accountCreated && (
        <p role="status" className="mt-5 rounded-lg border border-released/40 bg-released-soft px-4 py-3 text-sm text-released">
          Your Escrit account has been created and you are signed in.
        </p>
      )}
      {actionMessage && <p role="status" className="mt-4 text-sm text-released">{actionMessage}</p>}

      <div className="mt-8">
        <FeaturedCarousel type={type} items={items.slice(0, 8)} title={`Featured ${type}s`} empty={!items.length} compact />
      </div>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-line pb-3" role="tablist" aria-label="Listing type">
        {TYPES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setType(key);
              setSearchParams({ type: key });
            }}
            role="tab"
            aria-selected={type === key}
            className={`rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
              type === key ? 'border-b-2 border-forest-700 text-forest-800 dark:border-seal dark:text-ink' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="market-filters mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <label className="sr-only" htmlFor="market-search">Search listings</label>
        <input id="market-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search listings or sellers" className="min-w-0 rounded-lg border border-line bg-input px-3 py-2.5 text-sm" />
        <label className="sr-only" htmlFor="market-category">Category</label>
        <select id="market-category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-line bg-input px-3 py-2.5 text-sm">
          <option value="all">All categories</option>
          {categories.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <label className="sr-only" htmlFor="market-sort">Sort listings</label>
        <select id="market-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-line bg-input px-3 py-2.5 text-sm">
          <option value="newest">Newest</option><option value="popular">Most reviewed</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
        </select>
      </div>

      <div className="market-filters market-filters--secondary mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto]">
        <label className="text-xs text-ink/55">Minimum price (₦)<input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 text-sm" placeholder="Any" /></label>
        <label className="text-xs text-ink/55">Maximum price (₦)<input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 text-sm" placeholder="Any" /></label>
        <label className="text-xs text-ink/55">Minimum rating<select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 text-sm"><option value="0">Any rating</option><option value="3">3 stars & up</option><option value="4">4 stars & up</option><option value="4.5">4.5 stars & up</option></select></label>
        {type === 'product' && <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink/65"><input type="checkbox" checked={negotiableOnly} onChange={(event) => setNegotiableOnly(event.target.checked)} />Negotiable</label>}
      </div>
      {type === 'service' && <div className="mt-3 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-ink/55">Service model
          <select value={serviceModelFilter} onChange={(event) => setServiceModelFilter(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 text-sm">
            <option value="all">All service models</option><option value="appointment">Appointment</option><option value="fixed_scope">Fixed scope</option><option value="custom_quote">Custom quote</option>
          </select>
        </label>
        <label className="text-xs text-ink/55">Location
          <select value={serviceDeliveryFilter} onChange={(event) => setServiceDeliveryFilter(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 text-sm">
            <option value="all">Any location</option><option value="remote">Remote</option><option value="in-person">In person</option><option value="buyer-location">At buyer location</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs text-ink/65"><input type="checkbox" checked={appointmentScheduleFilter} onChange={(event) => setAppointmentScheduleFilter(event.target.checked)} />Has published appointment hours</label>
        <label className="flex min-h-11 items-center gap-2 text-xs text-ink/65"><input type="checkbox" checked={verifiedProvidersOnly} onChange={(event) => setVerifiedProvidersOnly(event.target.checked)} />Verified providers only</label>
      </div>}

      <div className="mt-6 flex items-center justify-between text-sm text-ink/60">
        <span>{visibleItems.length === items.length ? summary : `${visibleItems.length} of ${items.length} listings`}</span>
        <Link to="/" className="underline underline-offset-4 hover:text-ink">Back home</Link>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-dispute/30 bg-dispute/5 p-4 text-sm text-dispute">{error}</div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-line bg-line/20" />
          ))}
        </div>
      ) : (
        <div className="listing-grid mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {displayedItems.map((item) => {
            const image = item.images?.[0] || FALLBACK_IMAGES[type];
            const priceText =
              type === 'service'
                ? item.serviceModel === 'custom_quote'
                  ? Number(item.startingPrice || 0) > 0 ? `Starting at ₦${Number(item.startingPrice).toLocaleString()}` : 'Get a quote'
                  : Number(item.basePrice || 0) > 0 ? `From ₦${Number(item.basePrice).toLocaleString()}` : 'Price unavailable'
                : item.buyerPriceKobo == null ? 'Price unavailable' : `₦${Number(item.buyerPriceKobo / 100).toLocaleString()}`;
            const serviceDelivery = item.deliveryMethods?.length
              ? item.deliveryMethods.map((method) => ({
                online: 'Online',
                provider_location: 'Provider location',
                buyer_location: 'Buyer location',
                remote_deliverable: 'Remote deliverables',
              })[method] || method).join(' · ')
              : item.deliveryMode === 'hybrid' ? 'Remote or in person' : item.deliveryMode === 'in-person' ? 'In person' : 'Remote';
            const serviceTiming = item.serviceModel === 'appointment'
              ? item.durationMinutes ? `${item.durationMinutes} min` : 'Appointment'
              : item.serviceModel === 'fixed_scope' ? item.packages?.length
                ? `${Math.min(...item.packages.map((entry) => Number(entry.deliveryDays || 7)))} days from`
                : item.estimatedTime || 'Delivery time shown in package'
                : 'Timing agreed with provider';
            const isQuickViewOpen = quickViewId === item._id;

            return (
              <article key={item._id} className="listing-card group min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-card-md">
                <div className="relative aspect-[4/3] overflow-hidden bg-line/30">
                  <Link to={`/listing/${encodeURIComponent(item._id)}`} aria-label={`View ${item.title}`}>
                    <img src={image} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  </Link>
                  <button type="button" onClick={() => toggleFavorite(item)} aria-label={favoriteIds.has(`${type}:${item._id}`) ? `Remove ${item.title} from saved listings` : `Save ${item.title}`} title="Save listing" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-sm transition-colors hover:border-accent hover:text-accent">
                    <HeartIcon filled={favoriteIds.has(`${type}:${item._id}`)} />
                  </button>
                  {type === 'product' && item.stock < 1 && <span className="absolute bottom-2 left-2 rounded bg-paper/95 px-2 py-1 text-[10px] font-medium">Sold out</span>}
                </div>
                <div className="space-y-2.5 p-3 sm:p-4">
                  <div className="flex min-h-5 items-center justify-between gap-2 text-[10px] uppercase text-ink/50 sm:text-[11px]">
                    <span className="truncate">{item.category || 'General'}{type === 'service' ? ` · ${{ appointment: 'Appointment', fixed_scope: 'Fixed scope', custom_quote: 'Custom quote' }[item.serviceModel || 'appointment']}` : ''}</span>
                    <span className="shrink-0 text-seal">{type === 'service' && (item.sellerVerified || item.seller?.isVerified) ? 'Verified provider' : item.seller?.isDemoSeed ? 'Demo' : item.isFeatured ? 'Featured' : item.promotionUntil && new Date(item.promotionUntil) > new Date() ? 'Promoted' : item.negotiable ? 'Negotiable' : ''}</span>
                  </div>

                  <div>
                    <h2 className="min-h-10 font-display text-sm leading-5 sm:text-base"><Link to={`/listing/${encodeURIComponent(item._id)}`} className="line-clamp-2 hover:underline">{item.title}</Link></h2>
                    <Link to={`/marketplace/seller/${item.seller?._id}`} onClick={(event) => event.stopPropagation()} className="mt-1 block line-clamp-1 text-xs text-ink/55 hover:text-accent hover:underline">{item.seller?.displayName || item.seller?.businessName || 'Escrit seller'}</Link>
                  </div>

                  <div className="flex min-h-7 items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold sm:text-base">{priceText}</p>
                    <span className="shrink-0 text-[10px] text-ink/55 sm:text-xs">{Number(item.averageRating) > 0 ? `★ ${Number(item.averageRating).toFixed(1)}${item.reviewCount ? ` · ${item.reviewCount}` : ''}` : item.reviewCount ? `${item.reviewCount} reviews` : 'No reviews yet'}</span>
                  </div>
                  {type === 'service' && <p className="text-[10px] text-ink/55">{serviceDelivery} · {serviceTiming}</p>}
                  <p className="text-[10px] font-medium text-ink/55">{item.paymentOptionLabel || 'Payment options vary'}</p>

                  {isQuickViewOpen && <p className="line-clamp-3 border-t border-line pt-2 text-xs leading-5 text-ink/65">{item.description || 'No description provided yet.'}</p>}

                  <div className="flex items-center gap-2 border-t border-line pt-2.5">
                    <button type="button" onClick={() => setQuickViewId(isQuickViewOpen ? null : item._id)} aria-expanded={isQuickViewOpen} className="min-w-0 flex-1 text-left text-[11px] font-medium text-ink/60 hover:text-ink">
                      {isQuickViewOpen ? 'Less details' : 'Quick view'}
                    </button>
                    {type !== 'service' ? (
                      <button type="button" onClick={() => addToCart(item)} disabled={item.seller?.isDemoSeed || type === 'product' && item.stock < 1} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-accent px-2.5 py-2 text-[11px] font-semibold text-accent-ink transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3">
                        <CartIcon width={14} height={14} /> Add
                      </button>
                    ) : <Link to={`/listing/${encodeURIComponent(item._id)}`} className="shrink-0 rounded-md bg-accent px-2.5 py-2 text-center text-[11px] font-semibold text-accent-ink sm:px-3">View options</Link>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!loading && !error && items.length > 0 && visibleItems.length === 0 && <p className="mt-8 border-y border-line py-10 text-center text-sm text-ink/55">No listings match those filters.</p>}
      {!loading && displayedItems.length < visibleItems.length && <div className="mt-8 text-center"><button type="button" onClick={() => setDisplayLimit((current) => current + 24)} className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium hover:border-ink">Load more listings</button></div>}
    </div>
  );
}
