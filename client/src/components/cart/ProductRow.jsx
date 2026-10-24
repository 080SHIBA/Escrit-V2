import { Link } from 'react-router-dom';
import { formatNaira } from '../../lib/cartCheckout.js';

function listingFromEntry(entry) {
  if (entry.listing) return { ...entry.listing, type: entry.listingType };
  return { ...entry, type: entry.type || entry.listingType };
}

export default function ProductRow({ title, items = [], onAdd, busy }) {
  return (
    <section className="mt-9" aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="font-display text-lg sm:text-xl">{title}</h2>
        <span className="text-xs text-ink/45">{items.length} listings</span>
      </div>
      {items.length ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-3 lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-4">
          {items.map((entry) => {
            const listing = listingFromEntry(entry);
            const id = String(listing._id || listing.id);
            const image = listing.coverUrl || listing.images?.[0] || '';
            return (
              <article key={`${listing.type}:${id}`} className="w-56 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-paper sm:w-60 lg:w-auto">
                <Link to={`/listing/${encodeURIComponent(id)}`} className="block h-32 overflow-hidden bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                  {image ? <img src={image} alt="" className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none" /> : <span className="grid h-full place-items-center text-xs text-ink/50">No image</span>}
                </Link>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-ink/55">
                    <span className="rounded-full border border-line px-2 py-1 capitalize">{listing.type}</span>
                    <span aria-label={listing.ratingAvg || listing.averageRating ? `Rated ${listing.ratingAvg || listing.averageRating}` : 'No ratings yet'}>
                      {listing.ratingAvg || listing.averageRating ? `★ ${Number(listing.ratingAvg || listing.averageRating).toFixed(1)}` : 'New'}
                    </span>
                  </div>
                  <Link to={`/listing/${encodeURIComponent(id)}`} className="mt-2 block min-h-10 font-semibold leading-5 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{listing.title}</Link>
                  <p className="mt-1 font-semibold">{formatNaira(Number(listing.buyerPriceKobo ?? Number(listing.price || listing.basePrice || 0) * 100))}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAdd(listing)}
                    className="mt-3 min-h-11 w-full rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent hover:text-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-5 text-sm text-ink/55">No listings to show here yet.</p>
      )}
    </section>
  );
}
