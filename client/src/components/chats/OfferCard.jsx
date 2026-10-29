import { useState } from 'react';
import { canActOnOffer } from '../../lib/serviceChat.js';

function money(kobo) {
  return kobo == null ? 'Price to be agreed' : `₦${(Number(kobo) / 100).toLocaleString('en-NG')}`;
}

export default function OfferCard({
  offer,
  message,
  role,
  current = false,
  busy = false,
  onAccept,
  onCounter,
  onDecline,
}) {
  const [countering, setCountering] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const event = message?.offerEvent || {};
  const amount = event.priceKobo ?? offer?.currentPriceKobo;
  const scope = offer?.quoteSnapshot?.scope || event.note || offer?.fulfilmentCriteria;
  const timeline = offer?.quoteSnapshot?.timeline;
  const deliverables = offer?.quoteSnapshot?.deliverables || [];
  const canAccept = current && canActOnOffer(offer, role, 'accept');
  const canCounter = current && canActOnOffer(offer, role, 'counter');
  const canDecline = current && canActOnOffer(offer, role, 'decline');

  return (
    <section className="min-w-0 rounded-xl border border-accent/25 bg-paper p-4" aria-label="Service offer">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{event.action === 'requested' ? 'Service inquiry' : 'Service offer'}</h3>
          <p className="mt-1 text-xs text-ink/55">{current ? offer?.status === 'QUOTED' ? 'Pending your response' : offer?.status : 'Offer update'}</p>
        </div>
        <p className="font-display text-xl font-semibold">{money(amount)}</p>
      </div>
      {scope && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/75">{scope}</p>}
      {timeline && <p className="mt-3 text-sm text-ink/65"><span className="font-medium text-ink">Delivery:</span> {timeline}</p>}
      {deliverables.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/65">
          {deliverables.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      )}
      {canAccept || canCounter || canDecline ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canAccept && <button type="button" disabled={busy} onClick={onAccept} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-105 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Accept offer</button>}
          {canCounter && <button type="button" disabled={busy} onClick={() => setCountering((value) => !value)} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold hover:border-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Counter</button>}
          {canDecline && <button type="button" disabled={busy} onClick={onDecline} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink/70 hover:border-dispute hover:text-dispute disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Decline</button>}
        </div>
      ) : null}
      {countering && canCounter && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(eventSubmit) => {
            eventSubmit.preventDefault();
            if (Number(counterPrice) > 0) onCounter(Number(counterPrice));
          }}
        >
          <label className="min-w-36 flex-1 text-xs font-medium text-ink/65">
            Your price (₦)
            <input type="number" min="100" step="1" required value={counterPrice} onChange={(eventInput) => setCounterPrice(eventInput.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" />
          </label>
          <button type="submit" disabled={busy || !counterPrice} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold hover:border-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Send counter</button>
        </form>
      )}
    </section>
  );
}
