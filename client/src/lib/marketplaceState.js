import { MARKETPLACE_CATEGORIES_BY_TYPE } from '../../../shared/marketplaceCategories.js';

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
 * @property {string} [sellerVerificationStatus]
 * @property {string} [serviceModel]
 * @property {number} [startingPrice]
 * @property {string[]} [deliveryMethods]
 * @property {string} [deliveryMode]
 * @property {string} [serviceArea]
 * @property {number} [durationMinutes]
 * @property {string} [estimatedTime]
 * @property {Array<{ day: string, startTime?: string, endTime?: string }>} [availability]
 */
export { MARKETPLACE_CATEGORIES_BY_TYPE };
export const MARKETPLACE_CATEGORIES = MARKETPLACE_CATEGORIES_BY_TYPE.product;

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
  const minPrice = filters.minPrice === '' || filters.minPrice == null ? null : Number(filters.minPrice);
  const maxPrice = filters.maxPrice === '' || filters.maxPrice == null ? null : Number(filters.maxPrice);
  return listings.filter((listing) => {
    const searchable = `${listing.title} ${listing.description || ''} ${listing.category} ${listing.subcategory || ''} ${listing.sellerName} ${listing.serviceArea || ''} ${listing.serviceModel || ''}`.toLocaleLowerCase();
    const price = Number(listing.startingPrice || listing.price || 0);
    return (!query || searchable.includes(query))
      && (!filters.type || filters.type === 'all' || listing.type === filters.type)
      && (!filters.category || filters.category === 'all' || listing.category === filters.category)
      && (!minRating || (listing.ratingCount > 0 && Number(listing.ratingAvg) >= minRating))
      && (minPrice == null || price >= minPrice)
      && (maxPrice == null || price <= maxPrice);
  });
}

export function filterServiceListings(listings, filters = {}) {
  const model = filters.model || 'all';
  const location = filters.location || 'all';
  return listings.filter((listing) => {
    const methods = listing.deliveryMethods || [];
    const remote = methods.some((method) => ['online', 'remote_deliverable'].includes(method))
      || ['remote', 'hybrid'].includes(listing.deliveryMode);
    const inPerson = methods.some((method) => ['provider_location', 'buyer_location'].includes(method))
      || ['in-person', 'hybrid'].includes(listing.deliveryMode);
    const locationMatches = location === 'all'
      || (location === 'remote' && remote)
      || (location === 'in-person' && inPerson)
      || (location === 'buyer-location' && methods.includes('buyer_location'));
    return (model === 'all' || (listing.serviceModel || 'appointment') === model)
      && locationMatches
      && (!filters.appointmentSchedule || ((listing.serviceModel || 'appointment') === 'appointment' && listing.availability?.length > 0))
      && (!filters.verifiedProviders || Boolean(listing.sellerVerified));
  });
}

export function sortListings(listings, sort = 'newest') {
  const sorted = [...listings];
  return sorted.sort((left, right) => {
    const leftPrice = Number(left.startingPrice || left.price || 0);
    const rightPrice = Number(right.startingPrice || right.price || 0);
    if (sort === 'price-low') return leftPrice - rightPrice;
    if (sort === 'price-high') return rightPrice - leftPrice;
    if (sort === 'top-rated') {
      return right.ratingAvg - left.ratingAvg || right.ratingCount - left.ratingCount;
    }
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}
