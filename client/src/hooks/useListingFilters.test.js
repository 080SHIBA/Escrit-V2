import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLandingListings } from './useListingFilters.js';

const listings = [
  { id: '1', type: 'product', title: 'Linen tote', category: 'Fashion', sellerName: 'Ayo' },
  { id: '2', type: 'service', title: 'Brand identity design', category: 'Design services', sellerName: 'Studio Omi' },
  { id: '3', type: 'course', title: 'No-code web course', category: 'Digital goods', sellerName: 'Ada' },
  { id: '4', type: 'product', title: 'Cotton shirt', category: 'Fashion', sellerName: 'Nneka' },
];

test('landing filters match case-insensitive words across listing and seller text', () => {
  assert.deepEqual(
    filterLandingListings(listings, { query: '  LINEN  AYO ', type: 'all', category: 'all' }).map(({ id }) => id),
    ['1']
  );
  assert.deepEqual(
    filterLandingListings(listings, { query: 'studio', type: 'all', category: 'all' }).map(({ id }) => id),
    ['2']
  );
});

test('landing filters combine type, category, and search', () => {
  assert.deepEqual(
    filterLandingListings(listings, { query: '', type: 'product', category: 'Fashion' }).map(({ id }) => id),
    ['1', '4']
  );
  assert.deepEqual(
    filterLandingListings(listings, { query: 'web', type: 'course', category: 'Digital goods' }).map(({ id }) => id),
    ['3']
  );
  assert.deepEqual(
    filterLandingListings(listings, { query: 'linen', type: 'service', category: 'Fashion' }),
    []
  );
});
