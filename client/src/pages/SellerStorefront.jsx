import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  Copy,
  Flag,
  MapPin,
  Star,
  Store,
  Search,
  Check,
  ExternalLink,
  ShieldCheck,
  Tag,
  ArrowUpDown,
  Plus,
  SlidersHorizontal,
  Package,
  BookOpen,
  Briefcase,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';
import PhotoField from '../components/PhotoField.jsx';
import ListProductPage from './seller/ListProductPage.jsx';

const TYPES = [
  ['all', 'All listings', null],
  ['product', 'Products', Package],
  ['course', 'Courses', BookOpen],
  ['service', 'Services', Briefcase],
];

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-line bg-input px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none';

function sellerName(seller) {
  return seller?.displayName || seller?.businessName || seller?.fullName || 'Escrit seller';
}

function formatListingPrice(listing) {
  if (listing.listingType === 'service' && !listing.basePrice && !listing.price && !listing.buyerPriceKobo) return 'Get a quote';
  if (listing.buyerPriceKobo == null && listing.price == null && listing.basePrice == null) return 'Price unavailable';
  const amount = listing.buyerPriceKobo != null
    ? listing.buyerPriceKobo / 100
    : Number(listing.basePrice ?? listing.price ?? 0);
  return `₦${Number(amount).toLocaleString('en-NG')}`;
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
    terms.push(listing.deliveryMode === 'in-person' ? 'In-person' : listing.deliveryMode === 'hybrid' ? 'Remote or in-person' : 'Remote');
    if (listing.cancellationTerms) terms.push(`Cancel: ${listing.cancellationTerms}`);
    else if (listing.cancellationPolicy) terms.push(`Cancel: ${listing.cancellationPolicy}`);
  }
  if (listing.refundable) terms.push(listing.refundConditions ? `Refund: ${listing.refundConditions}` : 'Refundable under terms');
  else if (listing.refundable === false && ['product', 'course'].includes(listing.listingType)) terms.push('Non-refundable');
  return terms;
}

function Avatar({ seller, size = 'h-24 w-24', textSize = 'text-3xl' }) {
  const name = sellerName(seller);
  return seller?.profilePictureUrl ? (
    <img
      src={seller.profilePictureUrl}
      alt={name}
      className={`${size} shrink-0 rounded-full border-2 border-line object-cover shadow-sm`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} shrink-0 rounded-full border-2 border-line bg-accent/15 grid place-items-center font-display ${textSize} font-bold text-accent shadow-sm`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
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
      setTimeout(() => setProfileMessage(''), 4000);
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
      setCopyMessage('Link copied to clipboard!');
      setTimeout(() => setCopyMessage(''), 3000);
    } catch {
      setCopyFailed(true);
      setCopyMessage('Could not copy automatically. Please select and copy below.');
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

  if (error && !store) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p role="alert" className="text-sm font-semibold text-dispute">{error}</p>
        <button
          type="button"
          onClick={loadStore}
          className="mt-4 rounded-xl border border-line bg-paper px-4 py-2 text-sm font-medium hover:bg-paper-2"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="py-20 text-center text-sm text-ink/55">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="mt-3">Loading seller storefront…</p>
      </div>
    );
  }

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
    <div className="w-full pb-16">
      {/* Workspace Switcher Header for Store Owners */}
      {isOwnStore && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Seller Workspace</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">My storefront</h1>
          </div>
          
          <div className="flex rounded-xl border border-line bg-paper-2 p-1 text-xs font-medium" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={workspaceTab === 'preview'}
              onClick={() => setWorkspaceTab('preview')}
              className={`rounded-lg px-4 py-2 transition-all ${
                workspaceTab === 'preview'
                  ? 'bg-accent text-accent-ink font-semibold shadow-sm'
                  : 'text-ink/65 hover:text-ink'
              }`}
            >
              Storefront overview &amp; preview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspaceTab === 'list'}
              onClick={() => setWorkspaceTab('list')}
              className={`rounded-lg px-4 py-2 transition-all ${
                workspaceTab === 'list'
                  ? 'bg-accent text-accent-ink font-semibold shadow-sm'
                  : 'text-ink/65 hover:text-ink'
              }`}
            >
              + List new product
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STOREFRONT PREVIEW VIEW                                  */}
      {/* ======================================================== */}
      {(!isOwnStore || workspaceTab === 'preview') && (
        <div className="space-y-8">
          
          {/* Breadcrumb if visitor */}
          {!isOwnStore && (
            <div>
              <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-xs text-ink/60 hover:text-accent transition-colors">
                <span>← Back to Marketplace</span>
              </Link>
            </div>
          )}

          {/* ======================================================== */}
          {/* MOBILE PORTRAIT STORE HEADER (< lg)                      */}
          {/* ======================================================== */}
          <header className="lg:hidden rounded-2xl border border-line bg-paper-2 p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <Avatar seller={storefrontSeller} size="h-20 w-20" textSize="text-2xl" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider text-ink/45 font-semibold">Storefront</span>
                <h2 className="truncate font-display text-2xl font-bold text-ink">{sellerName(storefrontSeller)}</h2>
                
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {isIdentityVerified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <BadgeCheck size={14} aria-hidden="true" />
                      Verified Merchant
                    </span>
                  ) : (
                    <span className="text-ink/50">Verification pending</span>
                  )}
                </div>

                {storefrontSeller.city && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink/60">
                    <MapPin size={13} className="text-ink/40" />
                    <span>{storefrontSeller.city}</span>
                  </p>
                )}
              </div>
            </div>

            {storefrontSeller.bio && (
              <p className="whitespace-pre-line text-xs leading-relaxed text-ink/75 border-t border-line/60 pt-3">
                {storefrontSeller.bio}
              </p>
            )}

            {/* Rating & Fulfilment row */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {storefrontSeller.averageRating > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1 text-ink/80 font-mono">
                  <Star size={13} className="fill-ochre text-ochre" />
                  {Number(storefrontSeller.averageRating).toFixed(1)} ({storefrontSeller.reviewCount} reviews)
                </span>
              ) : (
                <span className="text-[11px] text-ink/50">No reviews yet</span>
              )}

              <span className="rounded-md bg-paper px-2 py-1 text-ink/65 text-[11px]">
                {storefrontFulfilment}
              </span>
            </div>

            {/* Mobile Actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-line/60">
              <button
                type="button"
                onClick={copyStorefrontLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-ink"
              >
                {copyMessage ? <Check size={15} /> : <Copy size={15} />}
                <span>{copyMessage || 'Copy storefront link'}</span>
              </button>

              {isOwnStore && (
                <Link
                  to={`/marketplace/seller/${id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-medium text-ink hover:bg-paper-3"
                >
                  <Store size={15} />
                  <span>View public store</span>
                </Link>
              )}

              {!isOwnStore && (
                <button
                  type="button"
                  onClick={() => setReporting((v) => !v)}
                  className="flex items-center justify-center gap-1.5 py-1 text-xs text-ink/45 hover:text-dispute"
                >
                  <Flag size={13} />
                  <span>Report seller</span>
                </button>
              )}
            </div>

            {reporting && (
              <form onSubmit={reportSeller} className="rounded-xl border border-line bg-paper p-3 text-xs space-y-2">
                <label htmlFor="mobile-report" className="font-semibold text-ink">Reason for reporting:</label>
                <textarea
                  id="mobile-report"
                  required
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-lg border border-line bg-input p-2 text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReporting(false)} className="rounded-lg border border-line px-3 py-1">Cancel</button>
                  <button type="submit" disabled={reportBusy || reportReason.trim().length < 5} className="rounded-lg bg-accent px-3 py-1 text-accent-ink font-semibold">Submit</button>
                </div>
              </form>
            )}
            {reportMessage && <p className="text-xs text-emerald-400">{reportMessage}</p>}
          </header>

          {/* ======================================================== */}
          {/* DESKTOP LANDSCAPE STORE HERO (hidden on mobile)          */}
          {/* ======================================================== */}
          <header className="hidden lg:block rounded-2xl border border-line bg-paper-2 p-8 shadow-sm">
            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-8">
              {/* Left Column: Avatar & Trust Credentials */}
              <div className="flex flex-col items-center text-center">
                <Avatar seller={storefrontSeller} size="h-28 w-28" textSize="text-4xl" />
                
                <div className="mt-3">
                  {isIdentityVerified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                      <BadgeCheck size={15} />
                      Identity Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-line px-3 py-1 text-xs font-medium text-ink/50">
                      Verification Pending
                    </span>
                  )}
                </div>

                {storefrontSeller.createdAt && (
                  <p className="mt-2 text-[11px] text-ink/40 font-mono">
                    Member since {new Date(storefrontSeller.createdAt).getFullYear()}
                  </p>
                )}
              </div>

              {/* Middle Column: Store Identity & Bio */}
              <div className="min-w-0 pr-4 space-y-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">Escrit Merchant</span>
                  <h2 className="mt-0.5 font-display text-3xl font-extrabold text-ink tracking-tight">{sellerName(storefrontSeller)}</h2>
                </div>

                {/* Rating & Location Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-ink/65">
                  {storefrontSeller.averageRating > 0 ? (
                    <span className="flex items-center gap-1.5 font-medium text-ink">
                      <Star size={16} className="fill-ochre text-ochre" />
                      <span>{Number(storefrontSeller.averageRating).toFixed(1)}</span>
                      <span className="text-xs text-ink/50">({storefrontSeller.reviewCount} customer reviews)</span>
                    </span>
                  ) : (
                    <span className="text-xs text-ink/50">No customer reviews yet</span>
                  )}

                  {storefrontSeller.city && (
                    <span className="flex items-center gap-1.5 text-xs text-ink/70 border-l border-line pl-4">
                      <MapPin size={14} className="text-accent" />
                      <span>{storefrontSeller.city}</span>
                    </span>
                  )}
                </div>

                {/* Bio */}
                {storefrontSeller.bio ? (
                  <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink/75">
                    {storefrontSeller.bio}
                  </p>
                ) : (
                  <p className="text-xs italic text-ink/40">No store description provided yet.</p>
                )}

                {/* Fulfilment Capability Badges in Landscape */}
                <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg border border-line bg-paper px-2.5 py-1 text-ink/70 font-medium">
                    {storefrontFulfilment}
                  </span>
                  {hasHostedCourses && (
                    <span className="rounded-lg border border-line bg-paper px-2.5 py-1 text-ink/70 font-medium flex items-center gap-1">
                      <BookOpen size={12} className="text-accent" /> Hosted courses
                    </span>
                  )}
                  {hasExternalCourses && (
                    <span className="rounded-lg border border-line bg-paper px-2.5 py-1 text-ink/70 font-medium">
                      External course materials
                    </span>
                  )}
                  {listings.some((item) => item.listingType === 'service') && (
                    <span className="rounded-lg border border-line bg-paper px-2.5 py-1 text-ink/70 font-medium flex items-center gap-1">
                      <Briefcase size={12} className="text-emerald-400" /> Chat for services
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Landscape Store Actions */}
              <div className="flex flex-col items-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={copyStorefrontLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-ink hover:brightness-110 shadow-sm transition-all"
                >
                  {copyMessage ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copyMessage || 'Copy storefront link'}</span>
                </button>

                {isOwnStore && (
                  <Link
                    to={`/marketplace/seller/${id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-medium text-ink hover:bg-paper-3 transition-colors"
                  >
                    <Store size={15} className="text-accent" />
                    <span>View public store</span>
                    <ExternalLink size={12} className="text-ink/40" />
                  </Link>
                )}

                {!isOwnStore && (
                  status === 'authed' ? (
                    <button
                      type="button"
                      onClick={() => setReporting((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-ink/50 hover:text-dispute hover:border-dispute/40 transition-colors"
                    >
                      <Flag size={14} /> Report seller
                    </button>
                  ) : (
                    <Link
                      to={`/sign-in?next=${encodeURIComponent(window.location.pathname)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-ink/50 hover:text-dispute hover:border-dispute/40 transition-colors"
                    >
                      <Flag size={14} /> Report seller
                    </Link>
                  )
                )}

                <div className="rounded-xl border border-line bg-surface/50 p-3 text-center min-w-[140px] mt-2">
                  <span className="text-[10px] uppercase tracking-wider text-ink/45 font-semibold">Catalog</span>
                  <p className="font-mono text-xl font-bold text-ink">{listings.length}</p>
                  <span className="text-[10px] text-ink/50">Active listings</span>
                </div>
              </div>
            </div>

            {/* Desktop Report form dropdown */}
            {reporting && (
              <form onSubmit={reportSeller} className="mt-6 border-t border-line pt-5 max-w-xl space-y-3">
                <label htmlFor="desktop-report" className="block text-xs font-semibold text-ink">
                  Reason for reporting this storefront:
                </label>
                <textarea
                  id="desktop-report"
                  required
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-xl border border-line bg-input p-3 text-xs text-ink"
                  placeholder="Please describe why this seller should be investigated..."
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReporting(false)} className="rounded-lg border border-line px-4 py-1.5 text-xs">Cancel</button>
                  <button type="submit" disabled={reportBusy || reportReason.trim().length < 5} className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink">Submit report</button>
                </div>
              </form>
            )}
            {reportMessage && <p className="mt-3 text-xs text-emerald-400">{reportMessage}</p>}
          </header>

          {/* ======================================================== */}
          {/* STORE DETAILS EDIT FORM (FOR STORE OWNER ONLY)           */}
          {/* ======================================================== */}
          {isOwnStore && (
            <div className="rounded-2xl border border-line bg-paper-2 p-6 shadow-sm">
              <div className="border-b border-line pb-4 mb-6">
                <h3 className="font-display text-xl font-bold text-ink">Edit Storefront Profile</h3>
                <p className="mt-1 text-xs text-ink/60">
                  Update public details shown to buyers on your store page. Bank account and legal identity details remain protected.
                </p>
              </div>

              {/* Landscape Side-by-Side: Form on Left, Live Preview on Right */}
              <form onSubmit={saveProfile} className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1">
                      Store Display Name (Buyer facing)
                    </label>
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      className={fieldClass}
                      placeholder="e.g. Studio Omi"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1">
                      City, State, or Delivery Zone
                    </label>
                    <input
                      maxLength={100}
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className={fieldClass}
                      placeholder="e.g. Ikeja, Lagos"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1">
                      Store Bio &amp; About
                    </label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      className={fieldClass}
                      placeholder="Tell buyers about your craftsmanship, guarantees, and services..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink/65 mb-1">
                      Store Profile Photo / Logo
                    </label>
                    <PhotoField
                      value={form.profilePictureUrl}
                      onChange={(profilePictureUrl) => setForm({ ...form, profilePictureUrl })}
                    />
                  </div>

                  {error && <p role="alert" className="text-xs text-dispute">{error}</p>}
                  {profileMessage && <p role="status" className="text-xs text-emerald-400 font-semibold">{profileMessage}</p>}

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-accent px-6 py-2.5 text-xs font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {saving ? 'Saving changes…' : 'Save storefront details'}
                  </button>
                </div>

                {/* Right: Live Interactive Card Preview */}
                <div className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-ink/50 font-semibold">Live storefront card preview</span>
                    
                    <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-paper/70 p-4">
                      <Avatar seller={{ ...storefrontSeller, ...form }} size="h-16 w-16" textSize="text-2xl" />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-display text-lg font-bold text-ink">
                          {form.displayName || 'Your display name'}
                        </h4>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink/60 truncate">
                          <MapPin size={12} className="text-accent" />
                          <span>{form.city || 'Location not set'}</span>
                        </p>
                      </div>
                    </div>

                    {form.bio && (
                      <p className="mt-4 whitespace-pre-line text-xs leading-relaxed text-ink/70 border-t border-line/60 pt-3">
                        {form.bio}
                      </p>
                    )}
                  </div>

                  <p className="mt-6 text-[11px] text-ink/45 leading-relaxed">
                    Buyers see this summary when clicking into your storefront from listing detail pages or search cards.
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* LISTINGS CATALOG SECTION (LANDSCAPE GRID ON DESKTOP)     */}
          {/* ======================================================== */}
          <section className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-ink">Live Store Listings</h3>
                <p className="mt-0.5 text-xs text-ink/60">
                  {visibleListings.length} of {listings.length} items available
                </p>
              </div>

              {/* Controls bar: search and sort */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search store listings…"
                    className="w-full rounded-xl border border-line bg-input pl-9 pr-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="rounded-xl border border-line bg-input px-3 py-2 text-xs text-ink appearance-none pr-8 focus:border-accent focus:outline-none"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                  <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none" />
                </div>

                {isOwnStore && (
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('list')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:brightness-110 shadow-sm"
                  >
                    <Plus size={14} /> List item
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills (Horizontal on Desktop & Mobile) */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist">
              {TYPES.map(([val, label, Icon]) => {
                const isSelected = type === val;
                return (
                  <button
                    key={val}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setType(val)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-accent bg-accent text-accent-ink font-semibold shadow-sm'
                        : 'border-line bg-paper-2 text-ink/65 hover:bg-paper-3 hover:text-ink'
                    }`}
                  >
                    {Icon && <Icon size={13} className={isSelected ? 'text-accent-ink' : 'text-ink/40'} />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Grid of Listings: Desktop Landscape (4-col) vs Mobile Portrait (1-2 col) */}
            {visibleListings.length === 0 ? (
              <div className="rounded-2xl border border-line bg-paper-2 p-12 text-center text-sm text-ink/55">
                <Store className="mx-auto h-8 w-8 text-ink/30" />
                <p className="mt-3 font-semibold text-ink">No matching listings found</p>
                <p className="mt-1 text-xs text-ink/45">
                  {listings.length ? 'Try adjusting your search terms or filter.' : 'This seller has not published any live listings yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {visibleListings.map((item) => {
                  const terms = listingTerms(item);
                  return (
                    <article
                      key={`${item.listingType}:${item._id}`}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-sm transition-all hover:border-line-strong hover:-translate-y-1 hover:shadow-md"
                    >
                      <Link
                        to={`/listing/${encodeURIComponent(item._id)}`}
                        className="flex flex-col h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        {/* Cover Image with Type Badge Overlay */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper">
                          {item.images?.[0] ? (
                            <img
                              src={item.images[0]}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-paper-3 text-3xl font-display text-ink/20">
                              {sellerName(storefrontSeller).charAt(0)}
                            </div>
                          )}

                          <span className="absolute top-2.5 left-2.5 rounded-md bg-paper/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink shadow-sm">
                            {item.listingType}
                          </span>

                          {item.isFeatured && (
                            <span className="absolute top-2.5 right-2.5 rounded-md bg-ochre px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper shadow-sm">
                              Featured
                            </span>
                          )}
                        </div>

                        {/* Card Details */}
                        <div className="flex flex-col flex-1 justify-between p-4 space-y-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/45">
                              {item.category || item.listingType}
                            </p>
                            <h4 className="mt-1 font-semibold text-sm text-ink line-clamp-2 leading-snug">
                              {item.title}
                            </h4>
                          </div>

                          <div className="border-t border-line/60 pt-3">
                            <p className="font-mono text-base font-extrabold text-ink">
                              {formatListingPrice(item)}
                            </p>

                            {terms.length > 0 && (
                              <p className="mt-1 text-[11px] text-ink/50 line-clamp-1">
                                {terms.join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* LIST PRODUCT MODE (EXPANSIVE WORKBENCH)                  */}
      {/* ======================================================== */}
      {isOwnStore && workspaceTab === 'list' && (
        <div className="mt-4">
          <ListProductPage embedded />
        </div>
      )}
    </div>
  );
}
