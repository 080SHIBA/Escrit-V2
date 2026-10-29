import test from 'node:test';
import assert from 'node:assert/strict';
import { filterListings, filterServiceListings, formatRating, getMarketplaceCardAction, MARKETPLACE_CATEGORIES_BY_TYPE, sortListings } from './marketplaceState.js';

const listings = [
  { id: '1', type: 'product', title: 'Linen tote', category: 'Fashion', sellerName: 'Ayo', price: 12000, ratingAvg: 4.8, ratingCount: 23, createdAt: '2026-01-02' },
  { id: '2', type: 'service', title: 'Brand identity design', category: 'Design services', sellerName: 'Studio Omi', price: 85000, ratingAvg: 5, ratingCount: 3, createdAt: '2026-01-03' },
  { id: '3', type: 'course', title: 'No-code web course', category: 'Digital goods', sellerName: 'Ada', price: 5000, ratingAvg: 0, ratingCount: 0, createdAt: '2026-01-01' },
  { id: '4', type: 'product', title: 'Cotton shirt', category: 'Fashion', sellerName: 'Nneka', price: 22000, ratingAvg: 4.8, ratingCount: 8, createdAt: '2026-01-04' },
];

test('filters combine search, type, category, and minimum rating', () => {
  assert.deepEqual(
    filterListings(listings, { q: 'linen', type: 'product', category: 'Fashion', minRating: '4.5' }).map(({ id }) => id),
    ['1']
  );
  assert.deepEqual(filterListings(listings, { type: 'all', minRating: 4.5 }).map(({ id }) => id), ['1', '2', '4']);
  assert.deepEqual(filterListings(listings, { q: 'ada', type: 'service' }), []);
});

test('service search and price filters include subcategory and an optional starting price', () => {
  const services = [
    { ...listings[1], subcategory: 'Logo design', serviceModel: 'fixed_scope', startingPrice: 45000, price: 85000 },
    { ...listings[1], id: '5', title: 'Hair appointment', subcategory: 'Barbering', serviceModel: 'appointment', startingPrice: 0, price: 25000 },
  ];
  assert.deepEqual(filterListings(services, { q: 'logo', minPrice: '40000', maxPrice: '50000' }).map(({ id }) => id), ['2']);
  assert.deepEqual(filterListings(services, { q: 'barber', minPrice: '20000', maxPrice: '30000' }).map(({ id }) => id), ['5']);
  assert.deepEqual(sortListings(services, 'price-low').map(({ id }) => id), ['5', '2']);
});

test('service filters use the published model, delivery methods, schedule and real verification status', () => {
  const services = [
    { id: 'appointment', type: 'service', serviceModel: 'appointment', deliveryMode: 'remote', deliveryMethods: ['online'], availability: [{ day: 'monday' }], sellerVerified: false },
    { id: 'fixed', type: 'service', serviceModel: 'fixed_scope', deliveryMode: 'remote', deliveryMethods: ['remote_deliverable'], sellerVerified: true },
    { id: 'quote', type: 'service', serviceModel: 'custom_quote', deliveryMode: 'hybrid', deliveryMethods: ['buyer_location'], sellerVerified: true },
  ];
  assert.deepEqual(filterServiceListings(services, { model: 'appointment' }).map(({ id }) => id), ['appointment']);
  assert.deepEqual(filterServiceListings(services, { location: 'buyer-location' }).map(({ id }) => id), ['quote']);
  assert.deepEqual(filterServiceListings(services, { appointmentSchedule: true }).map(({ id }) => id), ['appointment']);
  assert.deepEqual(filterServiceListings(services, { verifiedProviders: true }).map(({ id }) => id), ['fixed', 'quote']);
});

test('sorts by newest, both price directions, and top rated', () => {
  assert.deepEqual(sortListings(listings, 'newest').map(({ id }) => id), ['4', '2', '1', '3']);
  assert.deepEqual(sortListings(listings, 'price-low').map(({ id }) => id), ['3', '1', '4', '2']);
  assert.deepEqual(sortListings(listings, 'price-high').map(({ id }) => id), ['2', '4', '1', '3']);
  assert.deepEqual(sortListings(listings, 'top-rated').map(({ id }) => id), ['2', '1', '4', '3']);
});

test('formats ratings with one decimal and preserves the no-review state', () => {
  assert.equal(formatRating(4.75, 23), '4.8 (23)');
  assert.equal(formatRating(0, 0), 'No reviews yet');
});

test('routes service listings to booking or quote instead of the cart', () => {
  assert.equal(getMarketplaceCardAction(listings[0]), 'cart');
  assert.equal(getMarketplaceCardAction({ ...listings[1], serviceModel: 'appointment' }), 'book');
  assert.equal(getMarketplaceCardAction({ ...listings[1], serviceModel: 'custom_quote' }), 'request-quote');
});

test('provides category options tailored to products, services, and courses', () => {
  assert.ok(MARKETPLACE_CATEGORIES_BY_TYPE.course.includes('Digital Marketing'));
  assert.ok(MARKETPLACE_CATEGORIES_BY_TYPE.course.includes('Cybersecurity'));
  assert.ok(MARKETPLACE_CATEGORIES_BY_TYPE.course.includes('Dropshipping'));
  assert.ok(MARKETPLACE_CATEGORIES_BY_TYPE.course.includes('Web Development'));
  assert.ok(MARKETPLACE_CATEGORIES_BY_TYPE.service.includes('Digital Marketing'));
  assert.ok(MARKETPLACE_CATEGORIES_BY_TYPE.product.includes('Electronics'));
  assert.notDeepEqual(MARKETPLACE_CATEGORIES_BY_TYPE.product, MARKETPLACE_CATEGORIES_BY_TYPE.course);
});
