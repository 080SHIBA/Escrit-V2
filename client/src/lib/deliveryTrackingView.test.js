import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEta, receiptPath, showsTracking } from './deliveryTrackingView.js';

test('eta wording', () => {
  const now = new Date('2026-11-05T10:00:00');
  assert.equal(formatEta(null, now), 'Not set by the seller yet');
  assert.match(formatEta('2026-11-05T18:00:00', now), /^Today/);
  assert.match(formatEta('2026-11-06T10:00:00', now), /^Tomorrow/);
  assert.match(formatEta('2026-11-09T10:00:00', now), /^In 4 days/);
  assert.match(formatEta('2026-11-01T10:00:00', now), /^Was expected/);
});
test('only paid product orders show tracking', () => {
  assert.equal(showsTracking({ listingType: 'product', status: 'PAID_HELD', trackingCode: 'ESC-AAAA-BBBB' }), true);
  assert.equal(showsTracking({ listingType: 'course', status: 'PAID_HELD', trackingCode: 'x' }), false);
  assert.equal(showsTracking({ listingType: 'product', status: 'CREATED', trackingCode: 'x' }), false);
});
test('receipt url becomes an in-app path', () => {
  assert.equal(receiptPath('https://escrit.app/receipt/abc-def'), '/receipt/abc-def');
});
