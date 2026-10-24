export const PAYMENT_FAILURE_MESSAGE = 'We could not confirm your payment yet. If money left your account, it will show on your order once the provider confirms. Check your orders before trying again.';

export function cartItemKey(item) {
  return `${item.listingType || item.type}:${item.listing?._id || item.listingId || item.id}`;
}

export function formatNaira(kobo) {
  return `₦${(Number(kobo || 0) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

export function groupCartBySeller(items = []) {
  const groups = new Map();
  for (const item of items) {
    const listing = item.listing || item;
    const seller = listing.seller || {};
    const sellerId = String(seller._id || seller.id || listing.sellerId || 'unknown');
    if (!groups.has(sellerId)) {
      groups.set(sellerId, {
        sellerId,
        sellerName: seller.displayName || seller.businessName || listing.sellerName || 'Escrit seller',
        sellerVerified: seller.kycStatus ? seller.kycStatus === 'verified' : Boolean(seller.isVerified ?? listing.sellerVerified),
        items: [],
      });
    }
    groups.get(sellerId).items.push(item);
  }
  return [...groups.values()];
}

export function cartNeedsDeliveryAddress(items = []) {
  return items.some((item) => {
    const listing = item.listing || item;
    const type = item.listingType || item.type || listing.type;
    const fulfillment = resolveCartFulfilment(item);
    return type === 'product' && fulfillment === 'delivery';
  });
}

export function resolveCartFulfilment(item) {
  const listing = item.listing || item;
  const selected = item.fulfilment || item.fulfillment || listing.fulfilment;
  const offered = listing.fulfillmentMethod;
  if (selected === 'delivery' || selected === 'pickup') return selected;
  return offered === 'delivery-or-pickup' ? 'delivery' : selected || offered || '';
}

export function isDeliveryAddressValid(address) {
  return String(address || '').trim().length >= 10;
}

export function paymentChoicesForListing(listing) {
  const options = listing.paymentOptions || { escrow: true, direct: true };
  return [
    ...(options.escrow ? ['escrow'] : []),
    ...(options.direct ? ['direct'] : []),
  ];
}

export function resolveOrderPaymentChoice(listing, choice) {
  const available = paymentChoicesForListing(listing);
  if (available.length === 1) return available[0];
  return available.includes(choice) ? choice : available[0] || '';
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function paymentFailureState() {
  return { step: 'review', message: PAYMENT_FAILURE_MESSAGE };
}

export function filterRecommendations(items = [], { excludedIds = [], ownSellerId = '', limit = 10 } = {}) {
  const excluded = new Set(excludedIds.map(String));
  return items
    .filter((item) => !excluded.has(String(item.id || item._id)))
    .filter((item) => !ownSellerId || String(item.sellerId || item.seller?._id) !== String(ownSellerId))
    .sort((a, b) => Number(b.ratingAvg || b.averageRating || 0) - Number(a.ratingAvg || a.averageRating || 0)
      || Number(b.ratingCount || b.reviewCount || 0) - Number(a.ratingCount || a.reviewCount || 0))
    .slice(0, limit);
}
