import { useMemo, useState } from 'react';
import { BadgeCheck, Copy, Flag, Heart, MessageCircle, Store } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getListingAction, getListingPurchaseView, getPaymentLabel } from '../../lib/listingDetailState.js';
import ServiceDealPanel from '../ServiceDealPanel.jsx';
import PaymentOptionPicker from './PaymentOptionPicker.jsx';

function productFulfilment(listing) {
  const offered = listing.deliveryOptions?.map((option) => option.method) || [];
  if (listing.fulfillmentMethod === 'delivery-or-pickup' || (offered.includes('delivery') && offered.includes('pickup'))) return ['delivery', 'pickup'];
  if (listing.fulfillmentMethod === 'delivery') return ['delivery'];
  if (listing.fulfillmentMethod === 'pickup') return ['pickup'];
  if (offered.length) return [...new Set(offered)];
  return ['delivery'];
}

export default function BuyBox({
  listing,
  isOwn,
  isSaved,
  inCart,
  onAddToCart,
  onToggleSaved,
  onReport,
  onMessageSeller,
  onToast,
  paymentOption,
  onPaymentOptionChange,
  fulfilment,
  onFulfilmentChange,
  quantity,
  onQuantityChange,
  busy,
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const fulfilmentChoices = useMemo(() => productFulfilment(listing), [listing]);
  const typeLabel = `${listing.type.charAt(0).toUpperCase()}${listing.type.slice(1)}`;
  const paymentLabel = getPaymentLabel(listing.paymentOptions);
  const availability = listing.type === 'product'
    ? Number(listing.stock) > 0 ? `${listing.stock} in stock` : 'Out of stock'
    : listing.type === 'course' ? 'Available now' : listing.deliveryTime || listing.estimatedTime || 'Delivery time agreed with the seller';

  async function addAndGoToCart() {
    const added = await onAddToCart({ paymentOption, fulfilment, quantity });
    if (added) navigate('/account/cart');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      onToast('Listing link copied.');
    } catch {
      onToast('Unable to copy the listing link. Copy the address from your browser.');
    }
  }

  if (getListingPurchaseView(isOwn) === 'manage-only') {
    return (
      <aside className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6 min-[860px]:sticky min-[860px]:top-24">
        <p className="font-semibold">This is your listing</p>
        <Link to="/account/storefront?tab=list" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          <Store size={17} aria-hidden="true" /> Manage
        </Link>
      </aside>
    );
  }

  const serviceListing = listing.type === 'service'
    ? { ...listing, _id: listing._id || listing.id, seller: { ...(listing.seller || {}), _id: listing.sellerId || listing.seller?._id } }
    : null;

  return (
    <aside className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6 min-[860px]:sticky min-[860px]:top-24" aria-label="Purchase options">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">{typeLabel}</span>
        <span className="rounded-full border border-line px-3 py-1 text-xs text-ink/65">{listing.category}</span>
      </div>
      <h1 className="mt-4 font-display text-2xl leading-tight sm:text-3xl">{listing.title}</h1>
      <a href="#reviews" className="mt-3 inline-flex min-h-11 items-center text-sm text-ink/70 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
        <span aria-hidden="true" className="mr-1 text-seal">★</span>
        {listing.ratingCount ? `${Number(listing.ratingAvg).toFixed(1)} · ${listing.ratingCount} reviews` : 'No reviews yet'}
        <span className="sr-only">, jump to reviews</span>
      </a>
      <p className="mt-1 text-3xl font-semibold">₦{Number(listing.price).toLocaleString('en-NG')}</p>
      <p className="mt-2 text-sm text-ink/65">{availability}</p>

      {listing.type === 'product' && (
        <div className="mt-4 space-y-3">
          {fulfilmentChoices.length > 1 ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Delivery or pickup</legend>
              <div role="radiogroup" aria-label="Delivery or pickup" className="grid grid-cols-2 gap-2">
                {fulfilmentChoices.map((choice) => (
                  <label key={choice} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${fulfilment === choice ? 'border-accent bg-accent/5' : 'border-line'}`}>
                    <input type="radio" name="fulfilment" value={choice} checked={fulfilment === choice} onChange={() => onFulfilmentChange(choice)} className="h-4 w-4 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" />
                    {choice === 'pickup' ? 'Pickup' : 'Delivery'}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-ink/60">Cost and timing arranged with the seller.</p>
            </fieldset>
          ) : (
            <p className="rounded-lg border border-line px-3 py-2 text-sm">{fulfilmentChoices[0] === 'pickup' ? 'Pickup' : 'Delivery'} · cost and timing arranged with the seller</p>
          )}
          <label className="flex items-center gap-3 text-sm font-medium">Quantity
            <select value={quantity} onChange={(event) => onQuantityChange(Number(event.target.value))} className="min-h-11 rounded-lg border border-line bg-input px-3" aria-label="Quantity">
              {Array.from({ length: Math.max(0, Math.min(10, Number(listing.stock) || 0)) }, (_, index) => index + 1).map((amount) => <option key={amount} value={amount}>{amount}</option>)}
            </select>
          </label>
        </div>
      )}
      {listing.type === 'course' && <p className="mt-4 rounded-lg border border-line px-3 py-2 text-sm">Access: {listing.accessMethod || 'Course access details provided after purchase'}</p>}
      {listing.type === 'service' && <p className="mt-4 rounded-lg border border-line px-3 py-2 text-sm">Timing agreed in Escrit chat. Scheduling comes later.</p>}

      <div className="mt-5 border-t border-line pt-5">
        <PaymentOptionPicker options={listing.paymentOptions} value={paymentOption} onChange={onPaymentOptionChange} />
        {choicesForPayment(listing.paymentOptions).length > 1 && listing.paymentOptions?.[paymentOption] && (
          <p className="mt-2 text-xs leading-5 text-ink/65">
            {paymentOption === 'escrow'
              ? 'Payment is held until you confirm completion or the default window ends. Dispute before release.'
              : 'The seller is paid directly. Escrit cannot hold or recover the money; reporting is available.'}
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-2">
        <button type="button" onClick={() => onAddToCart({ paymentOption, fulfilment, quantity })} disabled={busy || !paymentOption || (listing.type === 'product' && Number(listing.stock) < 1)} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          {busy ? 'Updating…' : inCart ? 'Update cart' : 'Add to cart'}
        </button>
        <button type="button" onClick={addAndGoToCart} disabled={busy || !paymentOption || (listing.type === 'product' && Number(listing.stock) < 1)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          {getListingAction(listing.type)}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onToggleSaved} aria-pressed={isSaved} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            <Heart size={16} aria-hidden="true" className={isSaved ? 'fill-dispute text-dispute' : ''} />{isSaved ? 'Saved' : 'Save'}
          </button>
          <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            <Copy size={16} aria-hidden="true" />{copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs leading-5 text-ink/65">
        <li className="flex gap-2"><BadgeCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-released" />Seller verification status shown clearly</li>
        <li>Terms and any fees are shown before you pay.</li>
        <li>Review the payment summary before checkout.</li>
        {!isOwn && <li><button type="button" onClick={onReport} className="inline-flex min-h-11 items-center gap-2 text-left underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"><Flag size={14} aria-hidden="true" />Report this listing</button></li>}
      </ul>

      <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
        {listing.seller?.avatarUrl
          ? <img src={listing.seller.avatarUrl} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
          : <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 font-semibold text-accent">{listing.sellerName.trim().charAt(0).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{listing.sellerName}</p>
          <p className="inline-flex items-center gap-1 text-xs text-ink/60">{listing.sellerVerified && <BadgeCheck size={13} className="text-released" aria-hidden="true" />}{listing.sellerVerified ? 'Verified seller' : 'Seller'}</p>
        </div>
        <Link to={`/marketplace/seller/${encodeURIComponent(listing.sellerId || listing.seller?.id || '')}`} aria-label={`View ${listing.sellerName}'s storefront`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"><Store size={17} aria-hidden="true" /></Link>
      </div>
      <Link to={`/marketplace/seller/${encodeURIComponent(listing.sellerId || listing.seller?.id || '')}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">View storefront</Link>
      {listing.type === 'service' && (
        <button type="button" onClick={onMessageSeller} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          <MessageCircle size={16} aria-hidden="true" />Message seller
        </button>
      )}
      {listing.type === 'service' && <div id="seller-message" className="scroll-mt-24"><ServiceDealPanel service={serviceListing} /></div>}
      <p className="mt-3 text-xs font-medium text-ink/55">{paymentLabel}</p>
    </aside>
  );
}

function choicesForPayment(options = {}) {
  return [options.escrow, options.direct].filter(Boolean);
}
