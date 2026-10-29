import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { useCart } from '../hooks/useCart.js';
import { useListingDetail } from '../hooks/useListingDetail.js';
import { useSaved } from '../hooks/useSaved.js';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import { getDefaultPaymentOption } from '../lib/listingDetailState.js';
import BuyBox from '../components/listing-detail/BuyBox.jsx';
import DetailsTable from '../components/listing-detail/DetailsTable.jsx';
import Gallery from '../components/listing-detail/Gallery.jsx';
import RelatedListings from '../components/listing-detail/RelatedListings.jsx';
import ReviewsSection from '../components/listing-detail/ReviewsSection.jsx';
import SellerSection from '../components/listing-detail/SellerSection.jsx';
import StickyBuyBar from '../components/listing-detail/StickyBuyBar.jsx';
import TermsSection from '../components/listing-detail/TermsSection.jsx';

function setMeta({ name, property, content }) {
  const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
  let tag = document.head.querySelector(selector);
  const existed = Boolean(tag);
  if (!tag) {
    tag = document.createElement('meta');
    if (property) tag.setAttribute('property', property);
    else tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  const previous = tag.getAttribute('content');
  tag.setAttribute('content', content);
  return () => {
    if (existed) tag.setAttribute('content', previous || '');
    else tag.remove();
  };
}

function ListingSeo({ listing }) {
  useEffect(() => {
    if (!listing) return undefined;
    const title = `${listing.title} — ${listing.sellerName} | Escrit`;
    const description = String(listing.description || `${listing.type} listing in ${listing.category}. View details and payment options on Escrit.`).slice(0, 200);
    const restore = [
      setMeta({ name: 'description', content: description }),
      setMeta({ property: 'og:title', content: title }),
      setMeta({ property: 'og:description', content: description }),
      setMeta({ property: 'og:type', content: listing.type === 'product' ? 'product' : 'website' }),
      setMeta({ property: 'og:url', content: window.location.href }),
      setMeta({ property: 'og:image', content: listing.coverUrl || '' }),
      setMeta({ property: 'product:price:amount', content: String(listing.price) }),
      setMeta({ property: 'product:price:currency', content: 'NGN' }),
      setMeta({ name: 'twitter:card', content: 'summary_large_image' }),
      setMeta({ name: 'twitter:title', content: title }),
      setMeta({ name: 'twitter:description', content: description }),
    ];
    return () => {
      restore.forEach((restoreTag) => restoreTag());
    };
  }, [listing]);
  return null;
}

function ReportForm({ listing, onClose, onToast }) {
  const navigate = useNavigate();
  const { status } = useAuthContext();
  const [reason, setReason] = useState('misleading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (status !== 'authed') {
      navigate(`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.reportListing(listing.id, reason, listing.sellerId);
      onToast('Thanks. Your report has been sent for review.');
      onClose();
    } catch (err) {
      setError(err.message || 'We couldn’t submit your report. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="report-listing-title" className="w-full max-w-md rounded-2xl border border-line bg-paper p-5 shadow-card-lg">
        <h2 id="report-listing-title" className="font-display text-xl">Report this listing</h2>
        <p className="mt-2 text-sm leading-5 text-ink/65">Choose the reason that best describes your concern.</p>
        <label className="mt-4 block text-sm font-medium">Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3">
            <option value="misleading">Misleading information</option>
            <option value="prohibited">Prohibited item or service</option>
            <option value="fraud">Suspected fraud</option>
            <option value="other">Something else</option>
          </select>
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{busy ? 'Sending…' : 'Send report'}</button>
        </div>
      </form>
    </div>
  );
}

function AboutSection({ listing }) {
  const highlights = listing.type === 'course'
    ? [listing.highlights, listing.whatYouLearn, listing.curriculum?.map((module) => module.title)].find((values) => values?.length) || []
    : listing.type === 'service'
      ? [listing.included, listing.highlights, listing.deliverables].find((values) => values?.length) || []
      : listing.highlights || [];
  const heading = listing.type === 'course' ? "What you'll learn" : listing.type === 'service' ? "What's included" : 'Highlights';
  return (
    <section id="description" className="scroll-mt-28 border-t border-line pt-7" aria-labelledby="description-heading">
      <h2 id="description-heading" className="font-display text-xl">About this listing</h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/70">{listing.description || 'The seller has not added a description yet.'}</p>
      {highlights.length > 0 && (
        <div className="mt-5">
          <h3 className="font-semibold">{heading}</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {highlights.map((highlight, index) => <li key={`${highlight}-${index}`} className="rounded-lg bg-paper-2 px-3 py-2 text-sm leading-5">{highlight}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function Breadcrumbs({ listing }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink/55">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li><Link to="/marketplace" className="min-h-11 inline-flex items-center hover:text-ink hover:underline">Marketplace</Link></li>
        <li aria-hidden="true">/</li>
        <li><Link to={`/marketplace?category=${encodeURIComponent(listing.category)}`} className="min-h-11 inline-flex items-center hover:text-ink hover:underline">{listing.category}</Link></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="max-w-[16rem] truncate text-ink">{listing.title}</li>
      </ol>
    </nav>
  );
}

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { seller, status } = useAuthContext();
  const { listing, reviews, ratingDistribution, related, sellerListings, loading, error } = useListingDetail(id);
  useRecentlyViewed(listing);
  const { cartIds, addToCart } = useCart();
  const { savedIds, toggleSaved: toggleSavedListing } = useSaved();
  const [paymentOption, setPaymentOption] = useState('');
  const [fulfilment, setFulfilment] = useState('delivery');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [reporting, setReporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const ownSellerId = String(seller?._id || seller?.id || seller?.sellerId || '');
  const isOwn = Boolean(listing && ownSellerId && ownSellerId === String(listing.sellerId));
  const inCart = listing ? cartIds.has(listing.id) : false;

  usePageTitle(listing?.title || 'Listing');
  useEffect(() => {
    if (!listing) return;
    setPaymentOption(getDefaultPaymentOption(listing.paymentOptions));
    const methods = listing.deliveryOptions?.map((option) => option.method) || [];
    setFulfilment(methods.includes('delivery') ? 'delivery' : methods.includes('pickup') ? 'pickup' : listing.fulfillmentMethod || 'delivery');
    setQuantity(1);
  }, [listing]);
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function addListingToCart(options) {
    if (status !== 'authed') {
      navigate(`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`);
      return false;
    }
    if (!listing || !options.paymentOption) {
      setActionError('Choose an available payment option before adding this listing.');
      return false;
    }
    setBusy(true);
    setActionError('');
    try {
      await addToCart(listing, options);
      setToast(`${listing.title} added to your cart.`);
      return true;
    } catch (err) {
      setActionError(err.message || 'We couldn’t add this listing to your cart. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleSaved() {
    if (status !== 'authed') {
      navigate(`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    try {
      const saved = await toggleSavedListing(listing);
      setToast(saved ? 'Listing saved for later.' : 'Listing removed from saved listings.');
    } catch (err) {
      setActionError(err.message || 'We couldn’t update your saved listings.');
    }
  }

  function openMessagePanel() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.getElementById('seller-message')?.scrollIntoView({ behavior, block: 'start' });
    document.querySelector('#seller-message input, #seller-message textarea')?.focus({ preventScroll: true });
  }

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10" aria-busy="true"><p className="text-sm text-ink/55">Loading listing…</p></div>;
  if (!listing && (error === 'not-found' || error === 'unavailable')) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="font-display text-2xl">{error === 'unavailable' ? 'This listing is no longer available' : 'We couldn’t find that listing'}</h1><p className="mt-3 text-sm leading-6 text-ink/65">{error === 'unavailable' ? 'The seller has deactivated this listing. Browse the marketplace to find something else.' : 'The link may be incorrect, or the listing may have been removed.'}</p><Link to="/marketplace" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-ink px-5 text-sm font-semibold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Browse marketplace</Link></div>;
  }
  if (!listing) return <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert"><h1 className="font-display text-2xl">We couldn’t load this listing</h1><p className="mt-3 text-sm text-ink/65">{error || 'Please check your connection and try again.'}</p><Link to="/marketplace" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-ink px-5 text-sm font-semibold text-paper">Browse marketplace</Link></div>;

  const saved = savedIds.has(listing.id);
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pb-10 sm:pt-8">
      <ListingSeo listing={listing} />
      <Breadcrumbs listing={listing} />
      <nav aria-label="Listing sections" className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {[['description', 'Description'], ['details', 'Details'], ['terms', 'Terms'], ['reviews', 'Reviews'], ['seller', 'Seller']].map(([target, label]) => <a key={target} href={`#${target}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-4 text-sm hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{label}</a>)}
      </nav>
      {error && <p role="status" className="mb-4 rounded-lg border border-dispute/30 p-3 text-sm text-dispute">Some listing information could not be loaded. You can still review the available details.</p>}
      <main className="grid grid-cols-1 items-start gap-6 min-[860px]:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.9fr)] min-[860px]:gap-8">
        <div className="order-1 min-[860px]:col-start-1 min-[860px]:row-start-1">
          <Gallery key={listing.id} listing={listing} />
        </div>
        <div className="order-3 min-w-0 space-y-7 min-[860px]:col-start-1 min-[860px]:row-start-2">
          <AboutSection listing={listing} />
          <DetailsTable listing={listing} />
          <TermsSection listing={listing} />
          <ReviewsSection listing={listing} reviews={reviews} ratingDistribution={ratingDistribution} />
          <SellerSection listing={listing} sellerListings={sellerListings} isOwn={isOwn} />
        </div>
        <div className="order-2 min-w-0 min-[860px]:col-start-2 min-[860px]:row-span-2 min-[860px]:row-start-1">
          <BuyBox
            listing={listing}
            isOwn={isOwn}
            isSaved={saved}
            inCart={inCart}
            onAddToCart={addListingToCart}
            onToggleSaved={toggleSaved}
            onReport={() => setReporting(true)}
            onMessageSeller={openMessagePanel}
            onToast={setToast}
            paymentOption={paymentOption}
            onPaymentOptionChange={setPaymentOption}
            fulfilment={fulfilment}
            onFulfilmentChange={setFulfilment}
            quantity={quantity}
            onQuantityChange={(value) => setQuantity(Math.max(1, Math.min(10, value)))}
            busy={busy}
          />
          {actionError && <p role="alert" className="mt-3 text-sm text-dispute">{actionError}</p>}
        </div>
        <div className="order-4 min-[860px]:col-span-2">
          <RelatedListings listings={related} />
        </div>
      </main>
      {!isOwn && listing.type !== 'service' && <StickyBuyBar listing={listing} disabled={busy || !paymentOption} onAddToCart={() => addListingToCart({ paymentOption, fulfilment, quantity })} />}
      {reporting && <ReportForm listing={listing} onClose={() => setReporting(false)} onToast={setToast} />}
      {toast && <p role="status" aria-live="polite" className="fixed bottom-20 right-4 z-50 max-w-sm rounded-xl border border-line bg-paper px-4 py-3 text-sm shadow-card-lg sm:bottom-5">{toast}</p>}
    </div>
  );
}
