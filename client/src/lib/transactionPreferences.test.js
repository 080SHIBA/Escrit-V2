import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TRANSACTION_PREFERENCES,
  paymentOptionsForDefault,
  paymentOptionsLabel,
  resolveListingFulfilment,
  resolveListingPaymentOptions,
  validPaymentOptions,
} from './transactionPreferences.js';

test('new sellers default to escrow optional and fulfilment delivery', () => {
  assert.deepEqual(DEFAULT_TRANSACTION_PREFERENCES, {
    paymentDefault: 'both',
    fulfilmentDefault: 'delivery',
  });
  assert.equal(paymentOptionsLabel(paymentOptionsForDefault()), 'Escrow optional');
});

test('non-overriding listings follow current payment and fulfilment preferences', () => {
  const listing = { overridesDefault: false, fulfillmentOverridesDefault: false, paymentOptions: { escrow: true, direct: true }, fulfillment: 'pickup' };
  const preferences = { paymentDefault: 'direct', fulfilmentDefault: 'both' };
  assert.deepEqual(resolveListingPaymentOptions(listing, preferences), { escrow: false, direct: true });
  assert.equal(paymentOptionsLabel(resolveListingPaymentOptions(listing, preferences)), 'No escrow');
  assert.equal(resolveListingFulfilment(listing, preferences), 'delivery-or-pickup');
});

test('listing overrides retain their own payment and fulfilment options', () => {
  const listing = { overridesDefault: true, fulfillmentOverridesDefault: true, paymentOptions: { escrow: true, direct: false }, fulfillment: 'pickup' };
  const preferences = { paymentDefault: 'direct', fulfilmentDefault: 'delivery' };
  assert.deepEqual(resolveListingPaymentOptions(listing, preferences), { escrow: true, direct: false });
  assert.equal(paymentOptionsLabel(resolveListingPaymentOptions(listing, preferences)), 'Escrow only');
  assert.equal(resolveListingFulfilment(listing, preferences), 'pickup');
});

test('at least one payment option must remain enabled', () => {
  assert.equal(validPaymentOptions({ escrow: false, direct: false }), false);
  assert.equal(validPaymentOptions({ escrow: true, direct: false }), true);
  assert.equal(validPaymentOptions({ escrow: false, direct: true }), true);
});
