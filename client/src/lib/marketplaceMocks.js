import { filterListings, sortListings } from './marketplaceState.js';
import { getRatingDistribution } from './listingDetailState.js';

const delay = () => new Promise((resolve) => window.setTimeout(resolve, 100));
/**
 * @typedef {import('./marketplaceState.js').Listing} Listing
 * @typedef {Listing & { coverUrl: string, sellerId: string, createdAt: string, ratingEligible?: boolean }} MockListing
 */
/** @type {MockListing[]} */
const initialListings = [
  { id: 'mock-listing-01', type: 'product', title: 'Handwoven raffia tote', category: 'Fashion', price: 28500, coverUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-01', sellerName: 'Kora Goods', sellerVerified: true, ratingAvg: 4.8, ratingCount: 23, sellerRatingAvg: 4.8, sellerReviewCount: 23, isFeatured: true, createdAt: '2026-10-14T12:00:00.000Z' },
  { id: 'mock-listing-02', type: 'product', title: 'Studio wireless headphones', category: 'Electronics', price: 94500, coverUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-02', sellerName: 'Sound & Form', sellerVerified: true, ratingAvg: 4.6, ratingCount: 41, sellerRatingAvg: 4.6, sellerReviewCount: 41, isFeatured: true, createdAt: '2026-10-11T12:00:00.000Z' },
  { id: 'mock-listing-03', type: 'product', title: 'Ceramic table lamp', category: 'Home & living', price: 42000, coverUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-03', sellerName: 'North House', sellerVerified: false, ratingAvg: 0, ratingCount: 0, isFeatured: false, createdAt: '2026-10-08T12:00:00.000Z' },
  { id: 'mock-listing-04', type: 'product', title: 'Daily glow skincare set', category: 'Beauty & health', price: 19800, coverUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-04', sellerName: 'Aduke Botanics', sellerVerified: true, ratingAvg: 4.5, ratingCount: 12, sellerRatingAvg: 4.5, sellerReviewCount: 12, isFeatured: true, createdAt: '2026-10-06T12:00:00.000Z' },
  { id: 'mock-listing-05', type: 'product', title: 'Small-batch granola box', category: 'Food & groceries', price: 12500, coverUrl: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-05', sellerName: 'Morning Ritual', sellerVerified: true, ratingAvg: 4.9, ratingCount: 37, sellerRatingAvg: 4.9, sellerReviewCount: 37, isFeatured: true, createdAt: '2026-10-04T12:00:00.000Z' },
  { id: 'mock-listing-06', type: 'course', title: 'Build your first online store', category: 'Digital goods', price: 32000, coverUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-06', sellerName: 'Tomi Teaches', sellerVerified: true, ratingAvg: 4.7, ratingCount: 18, sellerRatingAvg: 4.7, sellerReviewCount: 18, isFeatured: true, createdAt: '2026-10-13T12:00:00.000Z', ratingEligible: true },
  { id: 'mock-listing-07', type: 'course', title: 'Product photography essentials', category: 'Digital goods', price: 18500, coverUrl: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-07', sellerName: 'Frame School', sellerVerified: false, ratingAvg: 4.3, ratingCount: 9, sellerRatingAvg: 4.3, sellerReviewCount: 9, isFeatured: true, createdAt: '2026-10-10T12:00:00.000Z' },
  { id: 'mock-listing-08', type: 'course', title: 'Healthy Nigerian weeknight meals', category: 'Food & groceries', price: 14500, coverUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-08', sellerName: 'Kitchen Notes', sellerVerified: true, ratingAvg: 4.9, ratingCount: 6, sellerRatingAvg: 4.9, sellerReviewCount: 6, isFeatured: true, createdAt: '2026-10-05T12:00:00.000Z' },
  { id: 'mock-listing-09', type: 'service', title: 'Brand identity starter package', category: 'Design services', price: 120000, coverUrl: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-09', sellerName: 'Studio Omi', sellerVerified: true, ratingAvg: 5, ratingCount: 14, sellerRatingAvg: 5, sellerReviewCount: 14, isFeatured: true, createdAt: '2026-10-12T12:00:00.000Z' },
  { id: 'mock-listing-10', type: 'service', title: 'Shopify store setup', category: 'Tech services', price: 175000, coverUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-10', sellerName: 'Build With Chidi', sellerVerified: true, ratingAvg: 4.7, ratingCount: 28, sellerRatingAvg: 4.7, sellerReviewCount: 28, isFeatured: true, createdAt: '2026-10-09T12:00:00.000Z' },
  { id: 'mock-listing-11', type: 'service', title: 'Wellness coaching session', category: 'Beauty & health', price: 35000, coverUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80', sellerId: 'seller-11', sellerName: 'Nia Wellness', sellerVerified: false, ratingAvg: 4.4, ratingCount: 5, sellerRatingAvg: 4.4, sellerReviewCount: 5, isFeatured: true, createdAt: '2026-10-02T12:00:00.000Z' },
  { id: 'mock-listing-12', type: 'service', title: 'Something useful, made for you', category: 'Other', price: 24000, coverUrl: '', sellerId: 'seller-12', sellerName: 'Made For You', sellerVerified: true, ratingAvg: 4.2, ratingCount: 3, sellerRatingAvg: 4.2, sellerReviewCount: 3, isFeatured: true, createdAt: '2026-10-01T12:00:00.000Z' },
];

const listings = initialListings.map((listing) => ({ ...listing }));
const cart = new Map();
const saved = new Set();
const reviews = new Map();
const cloneListing = (listing) => ({ ...listing });
const listingKey = (type, id) => `${type}:${id}`;

function legacyListing(listing) {
  return {
    _id: listing.id,
    title: listing.title,
    category: listing.category,
    images: listing.coverUrl ? [listing.coverUrl] : [],
    price: listing.price,
    basePrice: listing.price,
    buyerPriceKobo: listing.price * 100,
    averageRating: listing.ratingAvg,
    reviewCount: listing.ratingCount,
    seller: { _id: listing.sellerId, businessName: listing.sellerName, isVerified: listing.sellerVerified },
  };
}

function legacyEntries(keys, quantities = new Map()) {
  return [...keys].map((key) => {
    const [listingType, id] = key.split(':');
    const listing = listings.find((entry) => entry.id === id);
    const cartEntry = quantities.get(key);
    return listing ? {
      listingType,
      listing: {
        ...legacyListing(listing),
        fulfilment: cartEntry?.fulfilment || '',
        paymentOption: cartEntry?.paymentOption || '',
      },
      quantity: cartEntry?.quantity || 1,
    } : null;
  }).filter(Boolean);
}

function cartResult() {
  const items = legacyEntries(cart.keys(), cart);
  return { items, totalKobo: items.reduce((total, item) => total + item.listing.buyerPriceKobo * item.quantity, 0), feeQuoteAvailable: true };
}

function savedResult() {
  return { items: legacyEntries(saved) };
}

export const marketplaceMocksEnabled = import.meta.env.DEV && import.meta.env.VITE_MARKETPLACE_MOCK !== 'false';

export const marketplaceMockHandlers = {
  async getListings(params = {}) {
    await delay();
    const filtered = sortListings(filterListings(listings, params), params.sort || 'newest');
    const start = Math.max(0, Number(params.cursor || 0));
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 6));
    const items = filtered.slice(start, start + limit).map((listing) => {
      const detail = listingDetails[listing.id] || {};
      const offeredMethods = detail.deliveryOptions?.map((option) => option.method) || [];
      return {
        ...cloneListing(listing),
        paymentOptions: detail.paymentOptions || { escrow: false, direct: true },
        fulfillmentMethod: detail.fulfillmentMethod
          || (offeredMethods.includes('pickup') && !offeredMethods.includes('delivery') ? 'pickup' : 'delivery'),
      };
    });
    const nextCursor = start + items.length < filtered.length ? String(start + items.length) : null;
    return { items, nextCursor };
  },
  async getListing(id) {
    await delay();
    const listing = listings.find((entry) => entry.id === id);
    if (!listing) throw new Error('LISTING_NOT_FOUND');
    const detail = listingDetails[listing.id] || {};
    return {
      ...cloneListing(listing),
      ...detail,
      id: listing.id,
      type: listing.type,
      active: detail.active !== false,
      gallery: detail.gallery || (listing.coverUrl ? [listing.coverUrl] : []),
      paymentOptions: detail.paymentOptions || { escrow: false, direct: true },
      seller: {
        id: listing.sellerId,
        displayName: listing.sellerName,
        avatarUrl: detail.sellerAvatarUrl || '',
        isVerified: listing.sellerVerified,
        liveListingCount: 3,
        ratingAvg: listing.sellerRatingAvg || listing.ratingAvg,
        ratingCount: listing.sellerReviewCount || listing.ratingCount,
        bio: detail.sellerBio || 'Independent seller on Escrit.',
      },
    };
  },
  async getListingReviews(id) {
    await delay();
    if (!listings.some((entry) => entry.id === id)) throw new Error('LISTING_NOT_FOUND');
    const listingReviews = reviews.get(id) || seededReviews[id] || [];
    return { reviews: listingReviews.slice(0, 50), ratingDistribution: getRatingDistribution(listingReviews) };
  },
  async getRelatedListings(id) {
    await delay();
    const listing = listings.find((entry) => entry.id === id);
    if (!listing) throw new Error('LISTING_NOT_FOUND');
    return {
      items: listings
        .filter((entry) => entry.id !== id && (entry.category === listing.category || entry.sellerId === listing.sellerId))
        .slice(0, 4)
        .map(cloneListing),
      sellerListings: listings
        .filter((entry) => entry.id !== id && entry.sellerId === listing.sellerId)
        .slice(0, 3)
        .map(cloneListing),
    };
  },
  async getCart() {
    await delay();
    return { items: [...cart.keys()].map((key) => ({ id: key.split(':')[1], type: key.split(':')[0] })) };
  },
  async addCartItem({ listingId, type, quantity, fulfilment, paymentOption }) {
    await delay();
    const listing = listings.find((entry) => entry.id === listingId && entry.type === type);
    if (!listing) throw new Error('This listing is no longer available.');
    const key = listingKey(type, listingId);
    const previous = cart.get(key) || { quantity: 0 };
    cart.set(key, {
      quantity: quantity == null ? previous.quantity + 1 : Math.max(1, Math.min(Number(quantity) || 1, 10)),
      fulfilment: fulfilment || previous.fulfilment || '',
      paymentOption: paymentOption || previous.paymentOption || '',
    });
    return cartResult();
  },
  async removeCartItem(id) {
    await delay();
    for (const key of cart.keys()) if (key.split(':')[1] === id) cart.delete(key);
    return cartResult();
  },
  async getSaved() {
    await delay();
    return { items: [...saved].map((key) => ({ id: key.split(':')[1], type: key.split(':')[0] })) };
  },
  async saveListing(type, id) {
    await delay();
    if (!listings.some((entry) => entry.id === id && entry.type === type)) throw new Error('This listing is no longer available.');
    saved.add(listingKey(type, id));
    return savedResult();
  },
  async unsaveListing(type, id) {
    await delay();
    saved.delete(listingKey(type, id));
    return savedResult();
  },
  async getReviewEligibility(type, id, sellerId) {
    await delay();
    const listing = listings.find((entry) => entry.id === id && entry.type === type);
    return { eligible: Boolean(listing?.ratingEligible && sellerId !== listing.sellerId) };
  },
  async createReview(type, id, sellerId, payload) {
    await delay();
    const listing = listings.find((entry) => entry.id === id && entry.type === type);
    if (!listing?.ratingEligible || sellerId === listing.sellerId) {
      throw new Error('Only a buyer with a released escrow order can review this listing.');
    }
    if (reviews.has(id)) throw new Error('You have already reviewed this listing.');
    const listingReviews = [...(seededReviews[id] || []), {
      id: `${id}-review-new`,
      rating: payload.rating,
      comment: payload.comment || '',
      buyerName: 'Verified buyer',
      completedOrder: true,
      createdAt: new Date().toISOString(),
    }];
    reviews.set(id, listingReviews);
    listing.ratingCount += 1;
    listing.ratingAvg = Number((((listing.ratingAvg * (listing.ratingCount - 1)) + payload.rating) / listing.ratingCount).toFixed(1));
    listing.ratingEligible = false;
    return { ratingAvg: listing.ratingAvg, ratingCount: listing.ratingCount };
  },
  legacyCart: cartResult,
  legacySaved: savedResult,
  async setQuantity(type, id, quantity) {
    const key = listingKey(type, id);
    if (cart.has(key)) cart.set(key, { ...cart.get(key), quantity: Math.max(1, Number(quantity) || 1) });
    return cartResult();
  },
};

const gallery = (coverUrl, ...images) => [coverUrl, ...images].filter(Boolean).slice(0, 4);
const listingDetails = {
  'mock-listing-01': { stock: 5, condition: 'new', fulfillmentMethod: 'delivery-or-pickup', deliveryOptions: [{ method: 'delivery' }, { method: 'pickup' }], area: 'Lagos', paymentOptions: { escrow: true, direct: true }, highlights: ['Handwoven from locally sourced raffia', 'Roomy interior with reinforced handles'] },
  'mock-listing-02': { stock: 9, condition: 'new', fulfillmentMethod: 'delivery', deliveryOptions: [{ method: 'delivery' }], area: 'Abuja', paymentOptions: { escrow: true, direct: false }, highlights: ['Wireless listening with noise isolation', 'Includes charging cable and carry case'] },
  'mock-listing-03': { stock: 3, condition: 'new', fulfillmentMethod: 'pickup', deliveryOptions: [{ method: 'pickup' }], area: 'Port Harcourt', paymentOptions: { escrow: false, direct: true }, highlights: ['Hand-finished ceramic base', 'Warm ambient light'] },
  'mock-listing-04': { stock: 10, condition: 'new', fulfillmentMethod: 'delivery', deliveryOptions: [{ method: 'delivery' }], area: 'Lagos', paymentOptions: { escrow: true, direct: true }, highlights: ['Small-batch skincare essentials'] },
  'mock-listing-05': { stock: 6, condition: 'new', fulfillmentMethod: 'pickup', deliveryOptions: [{ method: 'pickup' }], area: 'Ibadan', paymentOptions: { escrow: true, direct: true }, highlights: ['Made in small batches'] },
  'mock-listing-06': { paymentOptions: { escrow: true, direct: true }, accessMethod: 'Lifetime access', format: 'Self-paced videos', level: 'Beginner', duration: '6 modules', highlights: ['Set up your storefront', 'Add products and take orders', 'Plan a launch'], curriculum: [{ title: 'Plan your store' }, { title: 'Build your storefront' }, { title: 'Launch and learn' }] },
  'mock-listing-07': { paymentOptions: { escrow: true, direct: false }, accessMethod: 'Online course access', format: 'Self-paced videos', level: 'Beginner', duration: '4 lessons', highlights: ['Use natural light', 'Style products for a clear shot'] },
  'mock-listing-08': { paymentOptions: { escrow: false, direct: true }, accessMethod: 'Digital download', format: 'PDF guide', level: 'All levels', duration: '12 recipes', highlights: ['Plan a week of meals', 'Cook balanced Nigerian staples'] },
  'mock-listing-09': { paymentOptions: { escrow: true, direct: true }, deliveryTime: '1-2 weeks', coordination: 'Remote', scheduling: 'Timing agreed in Escrit chat', highlights: ['Brand discovery session', 'Logo and colour direction', 'Starter brand guide'], included: ['Discovery call', 'Primary logo', 'Colour palette'], howItWorks: ['Share your brief', 'Review the first concepts', 'Approve the final files'] },
  'mock-listing-10': { paymentOptions: { escrow: true, direct: false }, deliveryTime: '2-3 weeks', coordination: 'Remote', scheduling: 'Timing agreed in Escrit chat', highlights: ['Store setup and configuration', 'Mobile-ready theme'], included: ['Store setup', 'Product upload guidance'], howItWorks: ['Share your requirements', 'Review the store draft', 'Receive the completed setup'] },
  'mock-listing-11': { paymentOptions: { escrow: false, direct: true }, deliveryTime: '60 minutes', coordination: 'Remote', scheduling: 'Timing agreed in Escrit chat', highlights: ['One-to-one coaching session'], included: ['60-minute video call'], howItWorks: ['Message the seller', 'Agree a time in chat', 'Meet for your session'] },
};

const seededReviews = Object.fromEntries(listings.filter((listing) => listing.ratingCount).map((listing) => [
  listing.id,
  Array.from({ length: listing.ratingCount }, (_, index) => ({
    id: `${listing.id}-review-${index + 1}`,
    rating: Math.max(3, Math.min(5, Math.round(listing.ratingAvg || 5) + (index % 2 ? 0 : -1))),
    comment: ['Clear communication and just as described.', 'A smooth experience from start to finish.', 'Good quality and helpful seller.'][index % 3],
    buyerName: ['A. Buyer', 'K. Reader', 'N. Customer'][index % 3],
    completedOrder: true,
    createdAt: new Date(Date.UTC(2026, 8, 10 - index)).toISOString(),
  })),
]));

for (const listing of listings) {
  const extra = listingDetails[listing.id] || {};
  const cover = listing.coverUrl;
  extra.gallery = extra.gallery || gallery(
    cover,
    `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80`,
    `https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80`,
    `https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80`,
  );
  listingDetails[listing.id] = extra;
}
