import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function BuyerLists({ mode }) {
  const isCart = mode === 'cart';
  usePageTitle(isCart ? 'Shopping cart' : 'Saved listings');
  const [items, setItems] = useState(null);
  const [quote, setQuote] = useState({ totalKobo: 0 });
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [kycRequired, setKycRequired] = useState(false);

  async function load() {
    try {
      const response = isCart ? await api.getCart() : await api.getFavorites();
      setItems(response.items || []);
      if (isCart) setQuote({ totalKobo: response.totalKobo || 0, feeQuoteAvailable: response.feeQuoteAvailable });
    } catch (err) {
      setError(err.message || 'Unable to load your listings.');
    }
  }

  useEffect(() => {
    load();
  }, [isCart]);

  async function checkoutCart(checkoutMode) {
    setError('');
    setCheckingOut(true);
    try {
      const { authorizationUrl, transactionId } = await api.checkoutCart({ checkoutMode });
      const firstItem = items?.[0];
      if (firstItem?.listing?.escrowLinkId) {
        localStorage.setItem(`escrit_last_order:${firstItem.listing.escrowLinkId}`, transactionId);
      }
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err.message || 'Unable to start checkout.');
      setKycRequired(err.message.toLowerCase().includes('identity details'));
      setCheckingOut(false);
    }
  }

  async function updateItem(entry, action, value) {
    const key = `${entry.listingType}:${entry.listing._id}`;
    setBusyKey(key);
    setError('');
    try {
      const response = isCart
        ? action === 'remove'
          ? await api.removeCartItem(entry.listingType, entry.listing._id)
          : await api.setCartQuantity(entry.listingType, entry.listing._id, value)
        : await api.removeFavorite(entry.listingType, entry.listing._id);
      setItems(response.items || []);
    } catch (err) {
      setError(err.message || 'Unable to update this listing.');
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Your account</p>
          <h1 className="mt-2 font-display text-3xl">{isCart ? 'Shopping cart' : 'Saved listings'}</h1>
        </div>
        <Link to="/marketplace" className="text-sm font-medium underline underline-offset-4">Continue browsing</Link>
      </div>

      {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dispute/30 p-3 text-sm text-dispute"><span>{error}</span>{!items && <button type="button" onClick={() => { setError(''); load(); }} className="font-medium underline underline-offset-4">Try again</button>}</div>}
      {kycRequired && <Link to={`/settings?next=${encodeURIComponent(window.location.pathname)}`} className="mt-3 inline-block text-sm font-medium underline underline-offset-4">Complete identity details to continue</Link>}
      {!items && !error && <ul aria-busy="true" aria-label="Loading your listings" className="mt-6 divide-y divide-line border-y border-line">{[0, 1].map((n) => <li key={n} className="flex gap-4 py-5"><div className="h-24 w-24 animate-pulse rounded-md bg-line/40 sm:h-28 sm:w-36" /><div className="flex-1 space-y-2"><div className="h-3 w-16 animate-pulse rounded bg-line/40" /><div className="h-4 w-1/2 animate-pulse rounded bg-line/40" /><div className="h-4 w-20 animate-pulse rounded bg-line/40" /></div></li>)}</ul>}
      {items?.length === 0 && (
        <div className="py-16 text-center">
          <h2 className="font-display text-xl">{isCart ? 'Your cart is empty' : 'No saved listings yet'}</h2>
          <p className="mt-2 text-sm text-ink/55">Browse Escrit and add listings you want to come back to.</p>
          <Link to="/marketplace" className="mt-5 inline-block rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper">Browse the marketplace</Link>
        </div>
      )}

      {items?.length > 0 && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem]">
          <ul className="divide-y divide-line border-y border-line">
            {items.map((entry) => {
              const listing = entry.listing;
              const price = listing.buyerPriceKobo != null ? listing.buyerPriceKobo / 100 : entry.listingType === 'service' ? listing.basePrice : listing.price;
              const key = `${entry.listingType}:${listing._id}`;
              return (
                <li key={key} className="flex gap-4 py-5">
                  <img src={listing.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80'} alt="" className="h-24 w-24 shrink-0 rounded-md object-cover sm:h-28 sm:w-36" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase text-ink/45">{entry.listingType}</p>
                    <h2 className="mt-1 truncate font-medium">{listing.title}</h2>
                    <Link to={`/marketplace/seller/${listing.seller?._id}`} className="mt-1 inline-block text-sm text-ink/55 hover:text-accent hover:underline">{listing.seller?.displayName || listing.seller?.businessName || 'Escrit seller'}</Link>
                    <p className="mt-2 font-semibold">₦{(Number(price || 0) * (isCart ? entry.quantity : 1)).toLocaleString()}</p>
                    {isCart && entry.listingType === 'product' && listing.refundable && <p className="mt-1 max-w-xl text-xs leading-5 text-ink/55">Missed pickup refund: 95% of the amount paid is returned; 5% is retained. This applies if the seller records a no-show.</p>}
                    {isCart && entry.listingType === 'course' && listing.refundable && <p className="mt-1 max-w-xl text-xs leading-5 text-ink/55">Refund conditions: {listing.refundConditions || 'See the course listing.'}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {isCart && entry.listingType === 'product' && (
                        <label className="flex items-center gap-2 text-xs text-ink/60">Qty
                          <input aria-label={`Quantity for ${listing.title}`} type="number" min="1" max={listing.stock} value={entry.quantity} disabled={busyKey === key} onChange={(event) => updateItem(entry, 'quantity', Number(event.target.value))} className="w-16 rounded border border-line bg-input px-2 py-1" />
                        </label>
                      )}
                      <button type="button" disabled={busyKey === key} onClick={() => updateItem(entry, 'remove')} className="text-xs text-ink/55 underline underline-offset-4 disabled:opacity-50">Remove</button>
                    </div>
                  </div>
                  {isCart && entry.listingType === 'service' && (
                    <Link to={`/marketplace/service/${listing._id}`} className="self-center rounded-lg border border-line px-3 py-2 text-center text-xs font-medium">View service</Link>
                  )}
                  {isCart && (
                    <Link to={`/marketplace/${entry.listingType}/${listing._id}`} className="self-center rounded-lg border border-line px-3 py-2 text-center text-xs font-medium">View payment options</Link>
                  )}
                </li>
              );
            })}
          </ul>
          {isCart && (
            <aside className="h-fit border-y border-line py-5 lg:sticky lg:top-24">
              <p className="flex justify-between gap-4 border-t border-line pt-4 font-medium"><span>Total</span><span>₦{(quote.totalKobo / 100).toLocaleString()}</span></p>
              <p className="mt-3 text-xs leading-relaxed text-ink/55">Each product or course becomes its own order. Choose one payment option for the cart; escrow orders hold payment until completion. Without escrow, Escrit cannot hold or recover the money, but you can still report problems.</p>
              {!quote.feeQuoteAvailable && <p className="mt-3 text-xs text-seal">The final total is being refreshed. Try again shortly.</p>}
              {items.every((entry) => entry.listing.paymentOptions?.escrow !== false) && (
                <button type="button" disabled={checkingOut || !items?.length || !quote.feeQuoteAvailable || items.some((entry) => entry.listingType === 'service')} onClick={() => checkoutCart('escrow')} className="mt-5 min-h-11 w-full rounded-lg border border-line px-4 py-3 text-sm font-medium disabled:opacity-50">
                  {checkingOut ? 'Preparing checkout…' : 'Checkout with escrow'}
                </button>
              )}
              {items.every((entry) => entry.listing.paymentOptions?.direct !== false) && (
                <button type="button" disabled={checkingOut || !items?.length || !quote.feeQuoteAvailable || items.some((entry) => entry.listingType === 'service')} onClick={() => checkoutCart('direct')} className="mt-3 min-h-11 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">
                  {checkingOut ? 'Preparing checkout…' : 'Checkout without escrow'}
                </button>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
