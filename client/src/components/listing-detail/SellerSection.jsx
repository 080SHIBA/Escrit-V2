import { BadgeCheck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

function SellerListings({ listings }) {
  return (
    <div className="mt-5">
      <h3 className="font-semibold">More from this seller</h3>
      {listings.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {listings.map((listing) => (
            <li key={listing.id} className="overflow-hidden rounded-xl border border-line">
              <Link to={`/listing/${encodeURIComponent(listing.id)}`} className="flex min-h-20 items-center gap-3 p-3 hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                {listing.coverUrl && <img src={listing.coverUrl} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{listing.title}</span>
                  <span className="mt-1 block text-sm text-ink/65">₦{Number(listing.price).toLocaleString('en-NG')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-ink/55">No other live listings from this seller yet.</p>}
    </div>
  );
}

export default function SellerSection({ listing, sellerListings }) {
  const seller = listing.seller || {};
  const name = listing.sellerName || seller.displayName || 'Escrit seller';
  const storefront = `/marketplace/seller/${encodeURIComponent(listing.sellerId || seller.id || seller._id)}`;
  return (
    <section id="seller" className="scroll-mt-28 border-t border-line pt-7" aria-labelledby="seller-heading">
      <h2 id="seller-heading" className="font-display text-xl">About the seller</h2>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        {seller.avatarUrl || listing.sellerAvatarUrl
          ? <img src={seller.avatarUrl || listing.sellerAvatarUrl} alt="" loading="lazy" className="h-14 w-14 rounded-full object-cover" />
          : <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full bg-accent/10 font-display text-xl text-accent">{name.trim().charAt(0).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{name}</p>
          <p className={`mt-1 flex items-center gap-1 text-xs ${listing.sellerVerified ? 'text-released' : 'text-ink/55'}`}>
            {listing.sellerVerified && <BadgeCheck size={15} aria-hidden="true" />}
            {listing.sellerVerified ? 'Verified seller' : 'Seller not verified'}
          </p>
          {seller.bio && <p className="mt-2 text-sm leading-5 text-ink/65">{seller.bio}</p>}
        </div>
        <Link to={storefront} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">View storefront</Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/65">
        <span>{Number(seller.liveListingCount || 0)} live listings</span>
        <span className="inline-flex items-center gap-1"><Star size={14} className="fill-seal text-seal" aria-hidden="true" /> {Number(seller.ratingAvg || listing.sellerRatingAvg || 0).toFixed(1)} average rating</span>
        <span>{Number(seller.ratingCount || listing.sellerReviewCount || 0)} reviews</span>
      </div>
      <SellerListings listings={sellerListings} />
    </section>
  );
}
