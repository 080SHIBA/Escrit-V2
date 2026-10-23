import { Link } from 'react-router-dom';

export default function RelatedListings({ listings }) {
  if (!listings.length) return null;
  return (
    <section className="border-t border-line pt-7" aria-labelledby="related-heading">
      <h2 id="related-heading" className="font-display text-xl">You may also like</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {listings.map((listing) => (
          <li key={listing.id} className="overflow-hidden rounded-xl border border-line bg-surface">
            <Link to={`/listing/${encodeURIComponent(listing.id)}`} className="block min-h-full hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              <img src={listing.coverUrl} alt={listing.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <span className="block p-3">
                <span className="block truncate text-xs text-ink/55">{listing.type}</span>
                <span className="mt-1 block line-clamp-2 min-h-10 text-sm font-semibold">{listing.title}</span>
                <span className="mt-2 block text-sm">₦{Number(listing.price).toLocaleString('en-NG')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
