import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTypePaymentRules, ctaFor, policyFor } from '../shared/listingTypePolicy.js';
import { getMarketplaceCardAction } from './marketplaceState.js';

test('each type has its own call to action', () => {
  assert.equal(ctaFor('product'), 'Add to cart');
  assert.equal(ctaFor('course'), 'Enroll');
  assert.equal(ctaFor('service', 'appointment'), 'Book now');
  assert.equal(ctaFor('service', 'custom_quote'), 'Request a quote');
});
test('only products use the cart', () => {
  assert.equal(policyFor('product').usesCart, true);
  assert.equal(policyFor('course').usesCart, false);
  assert.equal(policyFor('service').usesCart, false);
});
test('courses never use escrow; services and products keep the seller choice', () => {
  assert.deepEqual(applyTypePaymentRules('course', { escrow: true, direct: true }), { escrow: false, direct: true });
  const both = { escrow: true, direct: true };
  assert.equal(applyTypePaymentRules('service', both), both);
  assert.equal(applyTypePaymentRules('product', both), both);
});
test('card action follows the type', () => {
  assert.equal(getMarketplaceCardAction({ type: 'product' }), 'cart');
  assert.equal(getMarketplaceCardAction({ type: 'course' }), 'enroll');
  assert.equal(getMarketplaceCardAction({ type: 'service', serviceModel: 'appointment' }), 'book');
});
