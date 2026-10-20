export const LISTING_CATEGORIES = Object.freeze([
  'Fashion',
  'Electronics',
  'Home & living',
  'Beauty & health',
  'Food & groceries',
  'Digital goods',
  'Design services',
  'Tech services',
  'Other',
]);

export const DEFAULT_LISTING_FORM = Object.freeze({
  type: 'product',
  title: '',
  category: '',
  description: '',
  price: '',
  images: [],
  allowOffers: false,
  paymentOptions: { escrow: true, direct: true },
  overridesDefault: false,
  condition: 'new',
  fulfillment: 'delivery',
  fulfillmentOverridesDefault: false,
  quantity: '1',
  deliveryTime: '',
  format: 'self-paced-videos',
  level: 'beginner',
  duration: '',
});

/**
 * @typedef {Object} Listing
 * @property {string} id
 * @property {'product'|'service'|'course'} type
 * @property {string} title
 * @property {string} category
 * @property {string} description
 * @property {number|string} price
 * @property {string[]} images
 * @property {boolean} allowOffers
 * @property {'draft'|'live'} status
 * @property {'new'|'used'} [condition]
 * @property {'delivery'|'pickup'|'delivery-or-pickup'|'digital-download'} [fulfillment]
 * @property {number|string} [quantity]
 * @property {string} [deliveryTime]
 * @property {'self-paced-videos'|'live-cohort'|'pdf-ebook'} [format]
 * @property {'beginner'|'intermediate'|'advanced'} [level]
 * @property {string} [duration]
 */

export function validateListing(form, photos = []) {
  const errors = {};
  if (form.title.trim().length < 5) errors.title = 'Use at least 5 characters for the title.';
  if (form.title.trim().length > 80) errors.title = 'Keep the title to 80 characters or fewer.';
  if (!form.category) errors.category = 'Choose a category.';
  if (form.paymentOptions && !form.paymentOptions.escrow && !form.paymentOptions.direct) {
    errors.paymentOptions = 'Choose at least one payment option.';
  }
  if (form.description.length > 1000) errors.description = 'Keep the description to 1,000 characters or fewer.';
  if (!/^\d+$/.test(String(form.price)) || Number(form.price) <= 0) errors.price = 'Enter a price above ₦0 using digits only.';
  if (form.type === 'product' && (!/^\d+$/.test(String(form.quantity)) || Number(form.quantity) < 1)) errors.quantity = 'Quantity must be at least 1.';
  const uploadedPhotos = photos.filter((photo) => photo.url);
  if (['product', 'course'].includes(form.type) && uploadedPhotos.length < 1) errors.photos = 'Add at least one photo before publishing.';
  if (form.type === 'service' && !form.deliveryTime.trim()) errors.deliveryTime = 'Add an estimated delivery time.';
  if (form.type === 'course' && !form.duration.trim()) errors.duration = 'Add a duration or number of lessons.';
  return errors;
}

export function listingStrength(form, photos = []) {
  const descriptionLength = form.description.trim().length;
  const photoCount = photos.filter((photo) => photo.url).length;
  return Math.min(100,
    (form.title.trim().length >= 5 ? 15 : 0)
    + (Boolean(form.category) ? 10 : 0)
    + (descriptionLength >= 20 ? 15 : 0)
    + (descriptionLength >= 80 ? 10 : 0)
    + (Number(form.price) > 0 ? 20 : 0)
    + (photoCount >= 1 ? 15 : 0)
    + (photoCount >= 3 ? 15 : 0)
  );
}

export function nextStrengthTip(form, photos = []) {
  const photoCount = photos.filter((photo) => photo.url).length;
  if (form.title.trim().length < 5) return 'Add a title of at least 5 characters.';
  if (!form.category) return 'Choose a category so buyers can find your listing.';
  if (form.description.trim().length > 0 && form.description.trim().length < 80) return 'Add more detail to reach 80 description characters.';
  if (Number(form.price) <= 0) return 'Set a price in Naira.';
  if (form.type === 'service' && !form.deliveryTime.trim()) return 'Add an estimated service delivery time.';
  if (form.type === 'course' && !form.duration.trim()) return 'Add a course duration or lesson count.';
  if (photoCount < 1) return 'Add a clear cover photo.';
  if (photoCount < 3) return 'Add two more photos to strengthen your listing.';
  return 'Your listing has everything buyers need.';
}

export function formatNaira(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? `₦${price.toLocaleString('en-NG')}` : '₦0';
}

export function friendlyListingError(error) {
  const message = error?.message || '';
  if (/request failed|internal server|(^|\D)5\d\d(\D|$)/i.test(message)) return 'We couldn’t save your listing right now. Please retry.';
  return message || 'We couldn’t save your listing right now. Please retry.';
}
