import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Copy, Flag, MapPin, Star, Store } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';
import PhotoField from '../components/PhotoField.jsx';
import ListProductPage from './seller/ListProductPage.jsx';

const TYPES = [
  ['all', 'All'],
  ['product', 'Products'],
  ['course', 'Courses'],
  ['service', 'Services'],
];

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 py-2 text-sm';

function sellerName(seller) {
  return seller?.displayName || 'Escrit seller';
}

function formatListingPrice(listing) {
  if (listing.listingType === 'service' && !listing.basePrice) return 'Get a quote';
  if (listing.buyerPriceKobo == null) return 'Price unavailable';
  return `₦${Number(listing.buyerPriceKobo / 100).toLocaleString('en-NG')}`;
}

function listingSortPrice(listing) {
  const amount = listing.buyerPriceKobo == null
    ? Number(listing.basePrice ?? listing.price)
    : Number(listing.buyerPriceKobo) / 100;
  return Number.isFinite(amount) && amount >= 0 ? amount : Number.POSITIVE_INFINITY;
}

function listingTerms(listing) {
  const terms = [];
  if (listing.listingType === 'product') {
    const fulfilment = {
      delivery: 'Delivery',
      pickup: 'Pickup',
      'delivery-or-pickup': 'Delivery or pickup',
      'digital-download': 'Digital download',
    }[listing.fulfillmentMethod];
    if (fulfilment) terms.push(fulfilment);
    else if (listing.deliveryOptions?.length) {
      terms.push(listing.deliveryOptions.map((option) => `${option.method === 'pickup' ? 'Pickup' : 'Seller delivery'}${option.fee ? ` (₦${Number(option.fee).toLocaleString('en-NG')})` : ''}`).join(' · '));
    }
  }
  if (listing.listingType === 'course' && listing.format) {
    terms.push(listing.format === 'pdf-ebook' ? 'External course materials' : `Hosted ${listing.deliveryFormat === 'live' ? 'live' : 'self-paced'} course`);
  }
  if (listing.listingType === 'service') {
    terms.push(listing.deliveryMode === 'in-person' ? 'In-person service' : listing.deliveryMode === 'hybrid' ? 'Remote or in-person service' : 'Remote service');
    if (listing.cancellationTerms) terms.push(`Cancellation: ${listing.cancellationTerms}`);
    else if (listing.cancellationPolicy) terms.push(`Cancellation: ${listing.cancellationPolicy}`);
  }
  if (listing.refundable) terms.push(listing.refundConditions ? `Refund terms: ${listing.refundConditions}` : 'Refundable under the listing terms');
  else if (listing.refundable === false && ['product', 'course'].includes(listing.listingType)) terms.push('Non-refundable');
  return terms;
}

function Avatar({ seller, size = 'h-24 w-24' }) {
  return seller.profilePictureUrl
    ? <img src={seller.profilePictureUrl} alt="" className={`${size} shrink-0 rounded-full border border-line object-cover`} />
    : <span aria-hidden="true" className={`${size} shrink-0 rounded-full border border-line bg-accent/10 grid place-items-center font-display text-3xl text-accent`}>{sellerName(seller).trim().charAt(0).toUpperCase()}</span>;
}

export default function SellerStorefront() {
  const { sellerId } = useParams();
  const { seller: account, refreshSeller, status } = useAuthContext();
  const [searchParams] = useSearchParams();
  const isOwnStore = !sellerId;
  const id = sellerId || account?._id || account?.id;
  const [store, setStore] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState(searchParams.get('tab') === 'list' ? 'list' : 'preview');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [form, setForm] = useState({ displayName: '', profilePictureUrl: '', bio: '', city: '' });
  usePageTitle(store?.seller ? `${sellerName(store.seller)} storefront` : 'Seller storefront');

  const loadStore = useCallback(() => {
    if (!id) return Promise.resolve();
    setError('');
    return api.getPublicSeller(id, isOwnStore ? account : null)
      .then((data) => {
        setStore(data);
        if (isOwnStore) {
          setForm({
            displayName: data.seller.displayName || '',
            profilePictureUrl: data.seller.profilePictureUrl || '',
            bio: data.seller.bio || '',
            city: data.seller.city || '',
          });
        }
      })
      .catch((loadError) => setError(loadError.message || 'Seller storefront could not be loaded.'));
  }, [account, id, isOwnStore]);

  useEffect(() => {
    let active = true;
    if (!id) return undefined;
    api.getPublicSeller(id, isOwnStore ? account : null)
      .then((data) => {
        if (!active) return;
        setStore(data);
        if (isOwnStore) {
          setForm({
            displayName: data.seller.displayName || '',
            profilePictureUrl: data.seller.profilePictureUrl || '',
            bio: data.seller.bio || '',
            city: data.seller.city || '',
          });
        }
      })
      .catch((loadError) => active && setError(loadError.message || 'Seller storefront could not be loaded.'));
    return () => { active = false; };
  }, [account, id, isOwnStore]);

  useEffect(() => {
    if (!isOwnStore) return undefined;
    const onListingPublished = () => loadStore();
    window.addEventListener('escrit:listing-published', onListingPublished);
    return () => window.removeEventListener('escrit:listing-published', onListingPublished);
  }, [isOwnStore, loadStore]);

  const visibleListings = useMemo(() => {
    if (!store) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return store.listings
      .filter((listing) => type === 'all' || listing.listingType === type)
      .filter((listing) => !normalizedQuery || `${listing.title} ${listing.description || ''} ${listing.category || ''}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        if (sort === 'price-low' || sort === 'price-high') {
          const leftPrice = listingSortPrice(left);
          const rightPrice = listingSortPrice(right);
          if (leftPrice === rightPrice) return 0;
          return sort === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice;
        }
        return new Date(right.createdAt) - new Date(left.createdAt);
      });
  }, [query, sort, store, type]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setProfileMessage('');
    try {
      await api.updateSellerProfile(form);
      await refreshSeller();
      await loadStore();
      setProfileMessage('Your storefront details are saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save storefront details.');
    } finally {
      setSaving(false);
    }
  }

  async function copyStorefrontLink() {
    const storefrontUrl = `${window.location.origin}/marketplace/seller/${id}`;
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopyMessage('Storefront link copied.');
    } catch {
      setCopyFailed(true);
      setCopyMessage('Could not copy automatically. Select the link below and copy it.');
    }
  }

  async function reportSeller(event) {
    event.preventDefault();
    setReportBusy(true);
    setReportMessage('');
    try {
      await api.reportSeller(id, reportReason.trim());
      setReportMessage('Thanks. Your report has been sent to Escrit for review.');
      setReportReason('');
      setReporting(false);
    } catch (reportError) {
      setReportMessage(reportError.message || 'Your report could not be sent. Please try again.');
    } finally {
      setReportBusy(false);
    }
  }

  if (error && !store) return <div className="mx-auto max-w-4xl"><p role="alert" className="text-sm text-dispute">{error}</p><button type="button" onClick={loadStore} className="mt-3 text-sm font-medium underline">Try again</button></div>;
  if (!store) return <p className="py-10 text-sm text-ink/55">Loading seller storefront…</p>;

  const { seller: storefrontSeller, listings } = store;
  const storefrontFulfilment = storefrontSeller.fulfilmentDefault === 'both'
    ? 'Delivery and pickup'
    : storefrontSeller.fulfilmentDefault === 'delivery'
      ? 'Delivery'
      : storefrontSeller.fulfilmentDefault === 'pickup'
        ? 'Pickup'
        : 'Not specified';
  const hasHostedCourses = listings.some((item) => item.listingType === 'course' && item.format !== 'pdf-ebook');
  const hasExternalCourses = listings.some((item) => item.listingType === 'course' && item.format === 'pdf-ebook');
  const isIdentityVerified = storefrontSeller.identityVerified === true;

  return (
    <div className={`mx-auto ${isOwnStore && workspaceTab === 'list' ? 'max-w-none' : 'max-w-6xl'}`}>
      {isOwnStore && (
        <>
          <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Seller workspace</p>
          <h1 className="mt-2 font-display text-3xl">My storefront</h1>
          <div className="mt-5 flex flex-wrap gap-2 border-b border-line" role="tablist" aria-label="Storefront workspace">
            <button type="button" role="tab" aria-selected={workspaceTab === 'preview'} onClick={() => setWorkspaceTab('preview')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${workspaceTab === 'preview' ? 'border-accent text-accent' : 'border-transparent text-ink/55'}`}>Storefront preview</button>
            <button type="button" role="tab" aria-selected={workspaceTab === 'list'} onClick={() => setWorkspaceTab('list')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${workspaceTab === 'list' ? 'border-accent text-accent' : 'border-transparent text-ink/55'}`}>List product</button>
          </div>
        </>
      )}

      {(!isOwnStore || workspaceTab === 'preview') && (
        <>
          {!isOwnStore && <Link to="/marketplace" className="text-sm text-ink/55 underline underline-offset-4">Marketplace</Link>}
          <header className="mt-5 flex flex-wrap items-start gap-5 border-y border-line py-7">
            <Avatar seller={storefrontSeller} />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-ink/50">Seller storefront</p>
              <h2 className="mt-1 font-display text-3xl">{sellerName(storefrontSeller)}</h2>
              <p className={`mt-2 flex items-center gap-1.5 text-sm ${isIdentityVerified ? 'text-released' : 'text-ink/55'}`}>
                {isIdentityVerified && <BadgeCheck size={16} aria-hidden="true" />}
                {isIdentityVerified ? 'Identity verified' : 'Verification pending'}
              </p>
              {storefrontSeller.averageRating > 0 && storefrontSeller.reviewCount > 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/60"><Star size={15} className="fill-ochre text-ochre" aria-hidden="true" />{Number(storefrontSeller.averageRating).toFixed(1)} · {storefrontSeller.reviewCount} completed-order {storefrontSeller.reviewCount === 1 ? 'review' : 'reviews'}</p>
              ) : <p className="mt-2 text-sm text-ink/55">No completed-order reviews yet</p>}
              {storefrontSeller.city && <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/55"><MapPin size={15} aria-hidden="true" />{storefrontSeller.city}</p>}
              {storefrontSeller.bio && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-ink/65">{storefrontSeller.bio}</p>}
              {storefrontSeller.createdAt && Number.isFinite(new Date(storefrontSeller.createdAt).getTime()) && <p className="mt-3 text-xs text-ink/45">On Escrit since {new Date(storefrontSeller.createdAt).toLocaleDateString()}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={copyStorefrontLink} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium hover:border-accent"><Copy size={16} aria-hidden="true" />Copy storefront link</button>
                {copyMessage && <p role="status" className="self-center text-sm text-ink/55">{copyMessage}</p>}
                {copyFailed && <input aria-label="Storefront link" readOnly value={`${window.location.origin}/marketplace/seller/${id}`} onFocus={(event) => event.currentTarget.select()} className="min-h-11 w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink" />}
                {!isOwnStore && (
                  status === 'authed'
                    ? <button type="button" onClick={() => { setReporting((value) => !value); setReportMessage(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink/65 hover:border-dispute hover:text-dispute"><Flag size={16} aria-hidden="true" />Report seller</button>
                    : <Link to={`/sign-in?next=${encodeURIComponent(window.location.pathname)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink/65 hover:border-dispute hover:text-dispute"><Flag size={16} aria-hidden="true" />Report seller</Link>
                )}
              </div>
              {reporting && (
                <form onSubmit={reportSeller} className="mt-4 max-w-xl rounded-xl border border-line bg-paper-2 p-4">
                  <label className="block text-sm font-medium" htmlFor="seller-report-reason">Why are you reporting this seller?</label>
                  <textarea id="seller-report-reason" required minLength={5} maxLength={1000} rows={4} value={reportReason} onChange={(event) => setReportReason(event.target.value)} className={fieldClass} />
                  <div className="mt-3 flex flex-wrap gap-2"><button type="submit" disabled={reportBusy || reportReason.trim().length < 5} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50">{reportBusy ? 'Sending…' : 'Send report'}</button><button type="button" onClick={() => setReporting(false)} className="min-h-11 rounded-lg border border-line px-4 text-sm">Cancel</button></div>
                </form>
              )}
              {reportMessage && <p role="status" className="mt-3 text-sm text-ink/65">{reportMessage}</p>}
            </div>
            {isOwnStore && <Link to={`/marketplace/seller/${id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium hover:border-accent"><Store size={16} aria-hidden="true" />Open public storefront</Link>}
          </header>

          {isOwnStore && (
            <form onSubmit={saveProfile} className="mt-6 grid gap-6 rounded-2xl border border-line bg-paper-2 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]">
              <div className="space-y-4">
                <div><h3 className="font-display text-xl">Storefront details</h3><p className="mt-1 text-sm text-ink/55">These public details are separate from your legal identity and bank information.</p></div>
                <label className="block text-sm font-medium">Name buyers will see<input required minLength={2} maxLength={80} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={fieldClass} /></label>
                <label className="block text-sm font-medium">Location or delivery area<input maxLength={100} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className={fieldClass} /></label>
                <label className="block text-sm font-medium">Short bio<textarea rows={3} maxLength={500} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className={fieldClass} /></label>
                <div><PhotoField value={form.profilePictureUrl} onChange={(profilePictureUrl) => setForm({ ...form, profilePictureUrl })} /></div>
                {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
                {profileMessage && <p role="status" className="text-sm text-released">{profileMessage}</p>}
                <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-50">{saving ? 'Saving…' : 'Save storefront details'}</button>
              </div>
              <div className="rounded-xl border border-line bg-paper p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Live preview</p>
                <div className="mt-4 flex items-center gap-4"><Avatar seller={{ ...storefrontSeller, ...form }} size="h-16 w-16" /><div className="min-w-0"><h3 className="truncate font-display text-xl">{form.displayName || 'Your display name'}</h3><p className="mt-1 flex items-center gap-1 truncate text-xs text-ink/55">{form.city && <><MapPin size={13} aria-hidden="true" />{form.city}</>}</p></div></div>
                {form.bio && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-ink/65">{form.bio}</p>}
                <p className="mt-4 text-xs text-ink/45">Only your display name, photo, bio and location appear publicly. Identity verification is shown separately.</p>
              </div>
            </form>
          )}

          <section className="mt-8 rounded-xl border border-line bg-paper-2 p-4 sm:p-5" aria-labelledby="fulfilment-heading">
            <h3 id="fulfilment-heading" className="font-display text-lg">Fulfilment at this store</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-line bg-paper px-3 py-1.5">{storefrontFulfilment}</span>
              {hasHostedCourses && <span className="rounded-full border border-line bg-paper px-3 py-1.5">Hosted courses</span>}
              {hasExternalCourses && <span className="rounded-full border border-line bg-paper px-3 py-1.5">External course materials</span>}
              {listings.some((item) => item.listingType === 'service') && <span className="rounded-full border border-line bg-paper px-3 py-1.5">Chat for services</span>}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h3 className="font-display text-2xl">Live listings</h3><p className="mt-1 text-sm text-ink/55">{listings.length} approved and active</p></div>
              {isOwnStore && <button type="button" onClick={() => setWorkspaceTab('list')} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink">List product</button>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter storefront listings">
                {TYPES.map(([value, label]) => (
                  <button key={value} type="button" role="tab" aria-selected={type === value} onClick={() => setType(value)} className={`min-h-10 rounded-full border px-4 text-sm font-medium ${type === value ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-paper text-ink/65 hover:border-accent/50'}`}>{label}</button>
                ))}
              </div>
              <label className="sr-only" htmlFor="store-search">Search this storefront</label>
              <input id="store-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this storefront" className="min-h-10 min-w-52 rounded-lg border border-line bg-input px-3 text-sm" />
              <label className="sr-only" htmlFor="store-sort">Sort listings</label>
              <select id="store-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-10 rounded-lg border border-line bg-input px-3 text-sm"><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select>
            </div>
            {visibleListings.length === 0 ? <p className="mt-5 border-y border-line py-8 text-sm text-ink/55">{listings.length ? 'No live listings match your search.' : 'This seller has no live listings yet.'}</p> : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {visibleListings.map((item) => {
                  const terms = listingTerms(item);
                  return (
                    <article key={`${item.listingType}:${item._id}`} className="min-w-0 overflow-hidden rounded-xl border border-line bg-paper transition-shadow hover:shadow-card motion-reduce:transition-none">
                      <Link to={`/listing/${encodeURIComponent(item._id)}`} className="block h-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                        {item.images?.[0] ? <img src={item.images[0]} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-paper-2 text-3xl text-ink/30">{sellerName(storefrontSeller).charAt(0)}</div>}
                        <div className="p-3">
                          <p className="text-xs uppercase text-ink/45">{item.listingType}</p>
                          <h4 className="mt-1 line-clamp-2 min-h-10 text-sm font-medium">{item.title}</h4>
                          <p className="mt-2 font-semibold">{formatListingPrice(item)}</p>
                          {terms.length > 0 && <p className="mt-2 border-t border-line pt-2 text-xs leading-5 text-ink/55">{terms.join(' · ')}</p>}
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
            <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink/45">Each listing has its own terms and checkout details. Review them before you decide.</p>
          </section>
        </>
      )}
      {isOwnStore && workspaceTab === 'list' && <ListProductPage embedded />}
    </div>
  );
}
