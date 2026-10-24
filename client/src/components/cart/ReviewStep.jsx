import { formatNaira } from '../../lib/cartCheckout.js';

function paymentCopy(paymentOption) {
  return paymentOption === 'escrow'
    ? 'Use Escrit escrow — payment is held until completion or the default release window.'
    : 'Pay without escrow — the seller is paid directly. Escrit cannot hold or recover the money; reporting is available.';
}

export default function ReviewStep({
  review,
  items,
  selectedOrders,
  choices,
  termsAccepted,
  setTermsAccepted,
  busy,
  error,
  onPaymentChoice,
  onBack,
  onPay,
}) {
  const itemByKey = new Map(items.map((item) => [`${item.listingType}:${item.listing._id}`, item]));
  return (
    <section aria-labelledby="review-heading">
      <header className="mb-5">
        <h2 id="review-heading" className="font-display text-2xl">Review each order</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">Every listing is a separate order. Escrow is optional only where the listing offers both payment methods.</p>
      </header>
      <div className="space-y-4">
        {review?.orders.map((order) => {
          const key = `${order.listingType}:${order.listingId}`;
          const cartItem = itemByKey.get(key);
          const listing = cartItem?.listing || {};
          const available = [
            ...(listing.paymentOptions?.escrow ? ['escrow'] : []),
            ...(listing.paymentOptions?.direct ? ['direct'] : []),
          ];
          const selected = selectedOrders.find((choice) => `${choice.listingType}:${choice.listingId}` === key)?.paymentOption || order.paymentOption;
          return (
            <article key={key} className="rounded-xl border border-line bg-paper p-4 sm:p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{order.title}</h3>
                  <p className="mt-1 text-sm text-ink/60">Seller: {order.seller}</p>
                  <p className="mt-1 text-sm text-ink/60">Quantity: {order.quantity}</p>
                </div>
                <p className="font-semibold">{formatNaira(order.amountKobo + order.processingFeeKobo)}</p>
              </header>
              {available.length === 2 ? (
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold">Payment choice for this order</legend>
                  <div role="radiogroup" aria-label={`Payment choice for ${order.title}`} className="mt-2 grid gap-2">
                    {available.map((method) => (
                      <label key={method} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                        <input
                          type="radio"
                          name={`payment-${key}`}
                          value={method}
                          checked={selected === method}
                          onChange={() => onPaymentChoice(cartItem, method)}
                          className="mt-1 accent-accent"
                        />
                        <span className="text-sm leading-5">{paymentCopy(method)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="mt-4 rounded-lg bg-paper-2 p-3 text-sm leading-5">{paymentCopy(order.paymentOption)}</p>
              )}
              <div className="mt-5 border-t border-line pt-4">
                <h4 className="text-sm font-semibold">Terms for this order</h4>
                <dl className="mt-2 space-y-2 text-sm leading-5 text-ink/65">
                  <div><dt className="inline font-medium text-ink/80">Fulfilment: </dt><dd className="inline capitalize">{order.fulfilment ? order.fulfilment.replaceAll('-', ' ') : order.listingType === 'course' ? (listing.accessMethod || listing.format || 'Online access') : 'Discuss with seller'}</dd></div>
                  <div><dt className="inline font-medium text-ink/80">Completion: </dt><dd className="inline">{selected === 'escrow' ? `You confirm completion. If you do not respond, Escrit’s ${order.releaseWindowHours}-hour release window applies.` : 'Confirm delivery or completion directly with the seller.'}</dd></div>
                  <div><dt className="inline font-medium text-ink/80">Disputes: </dt><dd className="inline">Escrow orders can be disputed from your order. For direct payment, reporting is available, but Escrit cannot hold or recover funds.</dd></div>
                  <div>These terms are saved with your order.</div>
                </dl>
              </div>
            </article>
          );
        })}
      </div>

      <aside className="mt-5 rounded-xl border border-line bg-paper p-4 sm:p-5" aria-label="Payment summary">
        <h3 className="font-display text-lg">Amount to pay</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-ink/65">Items</dt><dd>{formatNaira(review?.subtotalKobo)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink/65">Payment processing fee</dt><dd>{formatNaira(review?.processingFeeKobo)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-line pt-3 font-semibold"><dt>Total</dt><dd>{formatNaira(review?.totalKobo)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-ink/55">Any other fee is shown here before you confirm.</p>
      </aside>

      <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-5">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          className="mt-1 h-4 w-4 accent-accent"
        />
        <span>I have reviewed the terms for each order.</span>
      </label>
      {error && <p className="mt-3 text-sm text-dispute" role="alert">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Back to cart</button>
        <button
          type="button"
          disabled={!termsAccepted || busy}
          onClick={onPay}
          className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {busy ? 'Preparing payment…' : `Pay ${formatNaira(review?.totalKobo)}`}
        </button>
      </div>
    </section>
  );
}
