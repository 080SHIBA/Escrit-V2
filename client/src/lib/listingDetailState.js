export const LISTING_TYPES = ['product', 'course', 'service'];

/**
 * @typedef {Object} ListingDetail
 * @property {string} id
 * @property {'product' | 'course' | 'service'} type
 * @property {string} title
 * @property {string} category
 * @property {number} price
 * @property {string[]} gallery
 * @property {{ escrow: boolean, direct: boolean }} paymentOptions
 * @property {string} sellerId
 * @property {string} sellerName
 */

/**
 * @typedef {Object} ListingReview
 * @property {string} [id]
 * @property {number} rating
 * @property {string} [comment]
 * @property {string} [buyerName]
 * @property {boolean} [completedOrder]
 * @property {string} [createdAt]
 */

/** @param {Record<string, any> | null | undefined} listing */
export function normalizeListingDetail(listing) {
  if (!listing) return null;
  const type = listing.type || listing.listingType;
  const id = listing.id || listing._id;
  const seller = listing.seller || {};
  return {
    ...listing,
    id,
    type,
    active: listing.active ?? listing.isActive ?? true,
    price: Number(listing.buyerPriceKobo != null ? listing.buyerPriceKobo / 100 : listing.basePrice ?? listing.price ?? 0),
    gallery: listing.gallery || listing.images || (listing.coverUrl ? [listing.coverUrl] : []),
    coverUrl: listing.coverUrl || listing.images?.[0] || '',
    sellerId: listing.sellerId || seller._id || '',
    sellerName: listing.sellerName || seller.displayName || seller.businessName || 'Escrit seller',
    sellerVerified: Boolean(listing.sellerVerified ?? seller.isVerified),
    paymentOptions: listing.paymentOptions || { escrow: false, direct: true },
  };
}

export function getPaymentLabel(paymentOptions = {}) {
  if (paymentOptions.escrow && paymentOptions.direct) return 'Escrow optional';
  if (paymentOptions.escrow) return 'Escrow only';
  if (paymentOptions.direct) return 'Pay without escrow';
  return 'Payment unavailable';
}

export function getDefaultPaymentOption(paymentOptions = {}) {
  if (paymentOptions.escrow) return 'escrow';
  if (paymentOptions.direct) return 'direct';
  return '';
}

export function getListingAction(type) {
  if (type === 'course') return 'Enrol now';
  if (type === 'service') return 'Hire now';
  return 'Buy now';
}

export function getListingPurchaseView(isOwn) {
  return isOwn ? 'manage-only' : 'purchase';
}

export function getListingDetailsPath(listing) {
  return `/listing/${encodeURIComponent(listing.id || listing._id)}`;
}

export function getRatingDistribution(reviews = []) {
  const completedReviews = reviews.filter((review) => review.completedOrder !== false);
  const total = completedReviews.length;
  return [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: completedReviews.filter((review) => Number(review.rating) === rating).length,
    percentage: total ? Number((completedReviews.filter((review) => Number(review.rating) === rating).length / total * 100).toFixed(1)) : 0,
  }));
}
