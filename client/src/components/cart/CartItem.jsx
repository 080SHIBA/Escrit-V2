import { Link } from 'react-router-dom';
import { formatNaira, resolveCartFulfilment } from '../../lib/cartCheckout.js';

function fulfilmentChoices(listing) {
  const methods = listing.deliveryOptions?.map((option) => option.method === 'seller_delivery' ? 'delivery' : option.method) || [];
  if (methods.includes('delivery') && methods.includes('pickup')) return ['delivery', 'pickup'];
  if (listing.fulfillmentMethod === 'delivery-or-pickup') return ['delivery', 'pickup'];
  return [];
}

export default function CartItem({ entry, busy, viewMode = 'list', wide = false, onUpdate, onRemove, onSaveForLater }) {
  const { listingType, listing } = entry;
  const options = fulfilmentChoices(listing);
  const image = listing.images?.[0] || listing.coverUrl || '';
  const amount = Number(listing.price || listing.basePrice || 0) * Number(entry.quantity || 1);
  const fulfillment = resolveCartFulfilment(entry);
  const accessMethod = listing.accessMethod || listing.format || listing.deliveryFormat || 'Online access';

  return (
    <article className={`flex min-w-0 gap-3 py-5 sm:gap-4 ${viewMode === 'grid' ? `lg:flex-col lg:rounded-xl lg:border lg:border-line lg:bg-paper-2 lg:p-3 ${wide ? 'xl:col-span-2 xl:flex-row xl:items-stretch' : ''}` : ''}`}>
      <Link to={`/listing/${encodeURIComponent(listing._id || listing.id)}`} className={`h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:h-28 sm:w-32 ${viewMode === 'grid' ? `lg:h-44 lg:w-full ${wide ? 'xl:h-auto xl:min-h-48 xl:w-72' : ''}` : ''}`}>
        {image
          ? <img src={image} alt="" className="h-full w-full object-cover" />
          : <span className="grid h-full place-items-center text-xs text-ink/50">No image</span>}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/55">
          <span className="rounded-full border border-line px-2 py-1 capitalize">{listingType}</span>
          <span>{listing.category || 'General'}</span>
        </div>
        <h3 className="mt-2 break-words font-semibold leading-5">
          <Link to={`/listing/${encodeURIComponent(listing._id || listing.id)}`} className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-2 font-semibold">{formatNaira(amount * 100)}</p>

        {listingType === 'product' && options.length === 2 ? (
          <fieldset className="mt-3">
            <legend className="text-xs font-medium text-ink/60">Fulfilment</legend>
            <div role="radiogroup" aria-label={`Fulfilment for ${listing.title}`} className="mt-1 flex flex-wrap gap-2">
              {options.map((option) => (
                <label key={option} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm capitalize has-[:checked]:border-accent has-[:checked]:bg-accent/10">
                  <input
                    type="radio"
                    name={`fulfilment-${listingType}-${listing._id}`}
                    value={option}
                    checked={fulfillment === option}
                    disabled={busy}
                    onChange={() => onUpdate(entry, { fulfilment: option })}
                    className="accent-accent"
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
        ) : listingType === 'product' ? (
          <p className="mt-2 text-sm capitalize text-ink/60">
            {fulfillment === 'delivery' ? 'Seller-arranged delivery' : fulfillment === 'pickup' ? 'Pickup' : 'Digital access'}
          </p>
        ) : listingType === 'course' ? (
          <p className="mt-2 text-sm text-ink/60">Access: {accessMethod}</p>
        ) : (
          <p className="mt-2 max-w-xl text-sm leading-5 text-ink/60">
            Agree timing in Escrit chat after payment. Scheduling comes later.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {listingType === 'product' && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink/70">
              Quantity
              <select
                aria-label={`Quantity for ${listing.title}`}
                value={entry.quantity}
                disabled={busy}
                onChange={(event) => onUpdate(entry, { quantity: Number(event.target.value) })}
                className="min-h-11 rounded-lg border border-line bg-input px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                {Array.from({ length: Math.min(10, Number(listing.stock || 10)) }, (_, index) => index + 1).map((quantity) => (
                  <option key={quantity} value={quantity}>{quantity}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" disabled={busy} onClick={() => onRemove(entry)} className="min-h-11 rounded-lg px-2 text-sm underline underline-offset-4 hover:text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Remove</button>
          <button type="button" disabled={busy} onClick={() => onSaveForLater(entry)} className="min-h-11 rounded-lg px-2 text-sm underline underline-offset-4 hover:text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Save for later</button>
        </div>
      </div>
    </article>
  );
}
