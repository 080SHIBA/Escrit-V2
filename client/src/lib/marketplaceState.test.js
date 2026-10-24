import test from 'node:test';
import assert from 'node:assert/strict';
import { filterListings, formatRating, getMarketplaceCardAction, sortListings } from './marketplaceState.js';

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
