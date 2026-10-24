import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cartNeedsDeliveryAddress,
  createIdempotencyKey,
  filterRecommendations,
  groupCartBySeller,
  isDeliveryAddressValid,
  paymentChoicesForListing,
  paymentFailureState,
  resolveCartFulfilment,
  resolveOrderPaymentChoice,
} from './cartCheckout.js';

test('cart items are grouped by seller and expose verification state', () => {
  const groups = groupCartBySeller([
    { listingType: 'product', listing: { _id: 'a', seller: { _id: 's1', businessName: 'North', kycStatus: 'verified' } } },
    { listingType: 'course', listing: { _id: 'b', seller: { _id: 's2', businessName: 'South', kycStatus: 'pending' } } },
    { listingType: 'service', listing: { _id: 'c', seller: { _id: 's1', businessName: 'North', kycStatus: 'verified' } } },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].sellerVerified, true);
  assert.equal(groups[1].sellerVerified, false);
});

test('only seller-arranged delivery requires a valid address', () => {
  assert.equal(cartNeedsDeliveryAddress([{ listingType: 'product', listing: { fulfillmentMethod: 'delivery' } }]), true);
  assert.equal(cartNeedsDeliveryAddress([{ listingType: 'product', listing: { fulfillmentMethod: 'pickup' } }]), false);
  assert.equal(cartNeedsDeliveryAddress([{ listingType: 'course', listing: { fulfillmentMethod: 'delivery' } }]), false);
  assert.equal(cartNeedsDeliveryAddress([{ listingType: 'product', listing: { fulfillmentMethod: 'delivery-or-pickup' } }]), true);
  assert.equal(resolveCartFulfilment({ listingType: 'product', listing: { fulfillmentMethod: 'delivery-or-pickup' } }), 'delivery');
  assert.equal(cartNeedsDeliveryAddress([{ listingType: 'product', fulfilment: 'pickup', listing: { fulfillmentMethod: 'delivery-or-pickup' } }]), false);
  assert.equal(isDeliveryAddressValid('  10 Main Street, Ikeja  '), true);
  assert.equal(isDeliveryAddressValid('Ikeja'), false);
});

test('each order resolves its own available payment choice', () => {
  const both = { paymentOptions: { escrow: true, direct: true } };
  const escrowOnly = { paymentOptions: { escrow: true, direct: false } };
  assert.deepEqual(paymentChoicesForListing(both), ['escrow', 'direct']);
  assert.equal(resolveOrderPaymentChoice(both, 'direct'), 'direct');
  assert.equal(resolveOrderPaymentChoice(escrowOnly, 'direct'), 'escrow');
});

test('idempotency keys are unique and payment failures return to review with safe guidance', () => {
  assert.notEqual(createIdempotencyKey(), createIdempotencyKey());
  assert.deepEqual(paymentFailureState(), {
    step: 'review',
    message: 'We could not confirm your payment yet. If money left your account, it will show on your order once the provider confirms. Check your orders before trying again.',
  });
});

test('recommendations exclude cart items and own listings, then sort by rating', () => {
  const items = filterRecommendations([
    { id: 'cart', ratingAvg: 5, sellerId: 'other' },
    { id: 'own', ratingAvg: 4.9, sellerId: 'me' },
    { id: 'lower', ratingAvg: 4.1, sellerId: 'other' },
    { id: 'top', ratingAvg: 4.9, sellerId: 'other', ratingCount: 2 },
  ], { excludedIds: ['cart'], ownSellerId: 'me' });

  assert.deepEqual(items.map((item) => item.id), ['top', 'lower']);
});
