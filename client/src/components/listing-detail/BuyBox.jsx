import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Copy, Flag, Heart, MessageCircle, Store } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getListingAction, getListingPurchaseView, getPaymentLabel } from '../../lib/listingDetailState.js';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
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
  const { status } = useAuthContext();
  const [copied, setCopied] = useState(false);
  const [serviceDate, setServiceDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [serviceSlots, setServiceSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(listing.packages?.[0]?.key || '');
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [directPaymentRiskAccepted, setDirectPaymentRiskAccepted] = useState(false);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [serviceLoading, setServiceLoading] = useState(false);
  const serviceIdempotencyKey = useRef('');
  const fulfilmentChoices = useMemo(() => productFulfilment(listing), [listing]);
  const typeLabel = `${listing.type.charAt(0).toUpperCase()}${listing.type.slice(1)}`;
  const paymentLabel = getPaymentLabel(listing.paymentOptions);
  const availability = listing.type === 'product'
    ? Number(listing.stock) > 0 ? `${listing.stock} in stock` : 'Out of stock'
    : listing.type === 'course' ? 'Available now' : listing.deliveryTime || listing.estimatedTime || 'Delivery time agreed with the seller';
  const serviceModel = listing.serviceModel || 'appointment';

  useEffect(() => {
    if (listing.type !== 'service' || serviceModel !== 'appointment') return undefined;
    let active = true;
    setServiceLoading(true);
    setServiceError('');
    api.getServiceAvailability(listing.id, serviceDate)
      .then(({ slots }) => {
        if (!active) return;
        setServiceSlots(slots || []);
        setSelectedSlot((current) => (slots || []).includes(current) ? current : '');
      })
      .catch((error) => active && setServiceError(error.message || 'Could not load appointment times.'))
      .finally(() => active && setServiceLoading(false));
    return () => { active = false; };
  }, [listing.id, listing.type, serviceDate, serviceModel]);

  useEffect(() => {
    if (listing.type === 'service') setSelectedPackage(listing.packages?.[0]?.key || '');
  }, [listing.id, listing.type, listing.packages]);

  async function placeServiceOrder() {
    if (status !== 'authed') {
      navigate(`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!paymentOption) {
      setServiceError('Choose a payment method before continuing.');
      return;
    }
    if (!termsAccepted) {
      setServiceError('Review and accept the service terms before continuing.');
      return;
    }
    if (paymentOption === 'direct' && !directPaymentRiskAccepted) {
      setServiceError('Acknowledge the risks of paying the provider directly before continuing.');
      return;
    }
    if (serviceModel === 'appointment' && !selectedSlot) {
      setServiceError('Choose an available appointment time.');
      return;
    }
    setServiceBusy(true);
    setServiceError('');
    try {
      if (!serviceIdempotencyKey.current) {
        serviceIdempotencyKey.current = window.crypto?.randomUUID?.() || `service-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const { order } = await api.createServiceOrder(listing.id, {
        idempotencyKey: serviceIdempotencyKey.current,
        appointmentAt: selectedSlot || null,
        packageKey: selectedPackage,
        addOnKeys: selectedAddOns,
        paymentMode: paymentOption,
        directPaymentRiskAccepted: paymentOption === 'direct' && directPaymentRiskAccepted,
        deliveryMethod: listing.deliveryMode === 'in-person' ? 'provider_location' : 'online',
        termsAccepted: true,
      });
      if (order.status === 'pending_approval') {
        serviceIdempotencyKey.current = '';
        onToast('Appointment request sent. The provider must confirm it before payment.');
        return;
      }
      const checkout = await api.checkoutServiceOrder(order._id);
      serviceIdempotencyKey.current = '';
      window.location.assign(checkout.authorizationUrl);
    } catch (error) {
      setServiceError(error.message || 'We could not create this service order. Please try again.');
    } finally {
      setServiceBusy(false);
    }
  }

  async function addAndGoToCart() {
    const added = await onAddToCart({ paymentOption, fulfilment, quantity });
    if (added) navigate('/cart');
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
      <p className="mt-1 text-3xl font-semibold">{listing.type === 'service' && serviceModel === 'custom_quote' ? 'Get a quote' : `₦${Number(listing.price).toLocaleString('en-NG')}`}</p>
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
      {listing.type === 'service' && serviceModel === 'appointment' && (
        <div className="mt-4 space-y-3 rounded-lg border border-line p-3">
          <label className="block text-sm font-medium">Choose an appointment date
            <input type="date" value={serviceDate} min={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="mt-2 min-h-11 w-full border border-line bg-input px-3" />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Available times ({listing.timeZone || 'seller time zone'})</legend>
            {serviceLoading ? <p className="mt-2 text-xs text-ink/55">Loading availability…</p> : serviceSlots.length ? (
              <div role="radiogroup" aria-label="Appointment time" className="mt-2 grid grid-cols-2 gap-2">
                {serviceSlots.map((slot) => <label key={slot} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2 text-xs ${selectedSlot === slot ? 'border-accent bg-accent/5' : 'border-line'}`}>
                  <input type="radio" name="service-slot" value={slot} checked={selectedSlot === slot} onChange={() => setSelectedSlot(slot)} />
                  {new Intl.DateTimeFormat(undefined, { timeZone: listing.timeZone || 'Africa/Lagos', hour: 'numeric', minute: '2-digit' }).format(new Date(slot))}
                </label>)}
              </div>
            ) : <p className="mt-2 text-xs text-ink/55">No times are available for this date.</p>}
          </fieldset>
        </div>
      )}
      {listing.type === 'service' && serviceModel === 'fixed_scope' && (
        <div className="mt-4 space-y-3 rounded-lg border border-line p-3">
          <label className="block text-sm font-medium">Choose a package
            <select value={selectedPackage} onChange={(event) => setSelectedPackage(event.target.value)} className="mt-2 min-h-11 w-full border border-line bg-input px-3">
              {(listing.packages || []).map((item) => <option key={item.key} value={item.key}>{item.name} · ₦{Number(item.priceNaira).toLocaleString()}</option>)}
            </select>
          </label>
          {(listing.addOns || []).map((addOn) => <label key={addOn.key} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedAddOns.includes(addOn.key)} onChange={(event) => setSelectedAddOns((current) => event.target.checked ? [...current, addOn.key] : current.filter((key) => key !== addOn.key))} />
            {addOn.name} · +₦{Number(addOn.priceNaira).toLocaleString()}
          </label>)}
        </div>
      )}

      <div className="mt-5 border-t border-line pt-5">
        <PaymentOptionPicker options={listing.paymentOptions} value={paymentOption} onChange={onPaymentOptionChange} />
        {choicesForPayment(listing.paymentOptions).length > 1 && listing.paymentOptions?.[paymentOption] && (
          <p className="mt-2 text-xs leading-5 text-ink/65">
            {paymentOption === 'escrow'
              ? 'Payment is held until you confirm completion or the default window ends. Dispute before release.'
              : 'The seller is paid directly. Escrit cannot hold or recover the money; reporting does not guarantee a refund.'}
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-2">
        {listing.type !== 'service' ? <>
          <button type="button" onClick={() => onAddToCart({ paymentOption, fulfilment, quantity })} disabled={busy || !paymentOption || (listing.type === 'product' && Number(listing.stock) < 1)} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {busy ? 'Updating…' : inCart ? 'Update cart' : 'Add to cart'}
          </button>
          <button type="button" onClick={addAndGoToCart} disabled={busy || !paymentOption || (listing.type === 'product' && Number(listing.stock) < 1)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {getListingAction(listing.type)}
          </button>
        </> : serviceModel !== 'custom_quote' ? <>
          <label className="flex items-start gap-2 text-xs leading-5 text-ink/65"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" />I reviewed the service scope, cancellation terms and payment method.</label>
          {paymentOption === 'direct' && <label className="flex min-h-11 items-start gap-2 text-xs leading-5 text-ink/65"><input type="checkbox" checked={directPaymentRiskAccepted} onChange={(event) => setDirectPaymentRiskAccepted(event.target.checked)} className="mt-1" />I understand that direct payment goes to the provider, Escrit cannot hold or recover it, and reporting does not guarantee a refund.</label>}
          <button type="button" onClick={placeServiceOrder} disabled={serviceBusy || !paymentOption || !termsAccepted || (paymentOption === 'direct' && !directPaymentRiskAccepted) || (serviceModel === 'appointment' && (!selectedSlot || serviceLoading)) || (serviceModel === 'fixed_scope' && !selectedPackage)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {serviceBusy ? 'Preparing order…' : serviceModel === 'appointment' ? 'Request appointment' : 'Continue to payment'}
          </button>
          {serviceError && <p role="alert" className="text-sm text-dispute">{serviceError}</p>}
        </> : null}
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
      {listing.type === 'service' && serviceModel === 'custom_quote' && <div id="seller-message" className="scroll-mt-24"><ServiceDealPanel service={serviceListing} /></div>}
      <p className="mt-3 text-xs font-medium text-ink/55">{paymentLabel}</p>
    </aside>
  );
}

function choicesForPayment(options = {}) {
  return [options.escrow, options.direct].filter(Boolean);
}
