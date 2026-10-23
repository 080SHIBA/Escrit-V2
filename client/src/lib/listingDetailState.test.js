import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getListingAction,
  getListingDetailsPath,
  getDefaultPaymentOption,
  getPaymentLabel,
  getListingPurchaseView,
  getRatingDistribution,
  normalizeListingDetail,
} from './listingDetailState.js';

test('normalizes product, course, and service detail records', () => {
  for (const type of ['product', 'course', 'service']) {
    const listing = normalizeListingDetail({ _id: `id-${type}`, listingType: type, price: 15000, images: ['cover.jpg'] });
    assert.equal(listing.id, `id-${type}`);
    assert.equal(listing.type, type);
    assert.equal(listing.price, 15000);
    assert.deepEqual(listing.gallery, ['cover.jpg']);
  }
  assert.equal(getListingAction('product'), 'Buy now');
  assert.equal(getListingAction('course'), 'Enrol now');
  assert.equal(getListingAction('service'), 'Hire now');
});

test('keeps payment labels accurate for each available payment-option combination', () => {
  assert.equal(getPaymentLabel({ escrow: true, direct: true }), 'Escrow optional');
  assert.equal(getPaymentLabel({ escrow: true, direct: false }), 'Escrow only');
  assert.equal(getPaymentLabel({ escrow: false, direct: true }), 'Pay without escrow');
  assert.equal(getPaymentLabel({ escrow: false, direct: false }), 'Payment unavailable');
  assert.equal(getDefaultPaymentOption({ escrow: true, direct: true }), 'escrow');
  assert.equal(getDefaultPaymentOption({ escrow: true, direct: false }), 'escrow');
  assert.equal(getDefaultPaymentOption({ escrow: false, direct: true }), 'direct');
  assert.equal(getDefaultPaymentOption({ escrow: false, direct: false }), '');
});

test('uses a manage-only buy box for the listing owner', () => {
  assert.equal(getListingPurchaseView(true), 'manage-only');
  assert.equal(getListingPurchaseView(false), 'purchase');
});

test('builds encoded detail URLs and review distribution from completed reviews', () => {
  assert.equal(getListingDetailsPath({ id: 'item name' }), '/listing/item%20name');
  assert.deepEqual(getRatingDistribution([{ rating: 5 }, { rating: 5 }, { rating: 2 }]), [
    { rating: 5, count: 2, percentage: 66.7 },
    { rating: 4, count: 0, percentage: 0 },
    { rating: 3, count: 0, percentage: 0 },
    { rating: 2, count: 1, percentage: 33.3 },
    { rating: 1, count: 0, percentage: 0 },
  ]);
  assert.deepEqual(getRatingDistribution([{ rating: 5, completedOrder: false }, { rating: 4 }]), [
    { rating: 5, count: 0, percentage: 0 },
    { rating: 4, count: 1, percentage: 100 },
    { rating: 3, count: 0, percentage: 0 },
    { rating: 2, count: 0, percentage: 0 },
    { rating: 1, count: 0, percentage: 0 },
  ]);
});
