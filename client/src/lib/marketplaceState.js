/**
 * @typedef {'product' | 'service' | 'course'} ListingType
 * @typedef {object} Listing
 * @property {string} id
 * @property {ListingType} type
 * @property {string} title
 * @property {string} category
 * @property {number} price
 * @property {string} coverUrl
 * @property {string} sellerId
 * @property {string} sellerName
 * @property {boolean} sellerVerified
 * @property {string} [sellerAvatarUrl]
 * @property {number} [sellerRatingAvg]
 * @property {number} [sellerReviewCount]
 * @property {boolean} [isFeatured]
 * @property {number} ratingAvg
 * @property {number} ratingCount
 */
export const MARKETPLACE_CATEGORIES = [
  'Fashion',
  'Electronics',
  'Home & living',
  'Beauty & health',
  'Food & groceries',
  'Digital goods',
  'Design services',
  'Tech services',
  'Other',
];

export function formatRating(ratingAvg, ratingCount) {
  if (!ratingCount) return 'No reviews yet';
  return `${Number(ratingAvg).toFixed(1)} (${ratingCount})`;
}

export function getMarketplaceCardAction(listing) {
  if (listing.type !== 'service') return 'cart';
  return listing.serviceModel === 'custom_quote' ? 'request-quote' : 'book';
}

export function filterListings(listings, filters = {}) {
  const query = String(filters.q || '').trim().toLocaleLowerCase();
  const minRating = Number(filters.minRating || 0);
  return listings.filter((listing) => {
    const searchable = `${listing.title} ${listing.category} ${listing.sellerName}`.toLocaleLowerCase();
    return (!query || searchable.includes(query))
      && (!filters.type || filters.type === 'all' || listing.type === filters.type)
      && (!filters.category || filters.category === 'all' || listing.category === filters.category)
      && (!minRating || (listing.ratingCount > 0 && Number(listing.ratingAvg) >= minRating));
  });
}

export function sortListings(listings, sort = 'newest') {
  const sorted = [...listings];
  return sorted.sort((left, right) => {
    if (sort === 'price-low') return left.price - right.price;
    if (sort === 'price-high') return right.price - left.price;
    if (sort === 'top-rated') {
      return right.ratingAvg - left.ratingAvg || right.ratingCount - left.ratingCount;
    }
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}
