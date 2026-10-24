import { formatNaira } from '../../lib/cartCheckout.js';

export default function OrderSummary({ cart, requiresAddress, addressValid, busy, onAddressChange, onReview }) {
  const itemsTotal = Number(cart?.subtotalKobo || 0);
  return (
    <aside className="h-fit rounded-xl border border-line bg-paper p-4 sm:p-5 lg:sticky lg:top-24">
      <h2 className="font-display text-xl">Order summary</h2>
      {requiresAddress && (
        <label className="mt-5 block text-sm font-semibold">
          Delivery address
          <textarea
            value={cart?.deliveryAddress || ''}
            onChange={(event) => onAddressChange(event.target.value)}
            minLength={10}
            maxLength={500}
            rows={3}
            required
            aria-describedby="cart-address-hint"
            placeholder="House number, street, area and city"
            className="mt-2 min-h-24 w-full rounded-lg border border-line bg-input px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          />
          <span id="cart-address-hint" className="mt-1 block text-xs font-normal text-ink/55">At least 10 characters. Delivery is arranged with the seller.</span>
        </label>
      )}
      <dl className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
        <div className="flex items-center justify-between gap-3"><dt className="text-ink/65">Items</dt><dd className="font-medium">{formatNaira(itemsTotal)}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-ink/65">Delivery</dt><dd className="text-right">Arranged with seller</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-ink/65">Fees</dt><dd className="text-right">Shown at review</dd></div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 font-semibold"><dt>Total before fees</dt><dd>{formatNaira(itemsTotal)}</dd></div>
      </dl>
      {!cart?.feeQuoteAvailable && <p className="mt-3 text-sm text-seal" role="status">Current prices are still loading. Try again shortly.</p>}
      <button
        type="button"
        disabled={busy || !cart?.items?.length || !addressValid || !cart?.feeQuoteAvailable}
        onClick={onReview}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 font-semibold text-accent-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        Review order
      </button>
    </aside>
  );
}
