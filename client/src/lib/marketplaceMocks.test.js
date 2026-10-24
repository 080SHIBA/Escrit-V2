import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceMockHandlers } from './marketplaceMocks.js';

test('repeating a checkout with the same idempotency key creates one mock payment', async () => {
  marketplaceMockHandlers.resetCheckoutMocks();
  await marketplaceMockHandlers.addCartItem({ type: 'product', listingId: 'mock-listing-01' });
  const payload = { idempotencyKey: 'checkout-idempotent-test-01', termsAccepted: true };

  const first = await marketplaceMockHandlers.payCart(payload);
  const repeated = await marketplaceMockHandlers.payCart(payload);

  assert.deepEqual(repeated, first);
  assert.equal(marketplaceMockHandlers.getCheckoutCreationCount(), 1);
});

test('a mock payment failure leaves the cart available for a safe retry', async () => {
  marketplaceMockHandlers.resetCheckoutMocks();
  await marketplaceMockHandlers.addCartItem({ type: 'product', listingId: 'mock-listing-02' });
  marketplaceMockHandlers.failNextPayment();
  const payload = { idempotencyKey: 'checkout-failure-test-01', termsAccepted: true };

  await assert.rejects(marketplaceMockHandlers.payCart(payload), /could not confirm your payment/i);
  const retry = await marketplaceMockHandlers.payCart(payload);

  assert.equal(retry.status, 'confirmed');
  assert.equal(marketplaceMockHandlers.getCheckoutCreationCount(), 1);
});

test('loads seller storefront data for a public seller and the signed-in mock seller', async () => {
  const publicStore = await marketplaceMockHandlers.getPublicSeller('seller-09');
  assert.equal(publicStore.seller.displayName, 'Studio Omi');
  assert.equal(publicStore.listings[0].listingType, 'service');

  const ownStore = await marketplaceMockHandlers.getPublicSeller('demo-buyer', {
    displayName: 'Demo Store',
    kycStatus: 'verified',
  });
  assert.equal(ownStore.seller.displayName, 'Demo Store');
  assert.deepEqual(ownStore.listings, []);
});
