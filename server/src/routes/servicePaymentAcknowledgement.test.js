import test from 'node:test';
import assert from 'node:assert/strict';
import { orderCreateSchema } from './services.js';
import { createSchema as serviceOfferCreateSchema } from './serviceOffers.js';

test('service orders require risk acknowledgement for direct payment only', () => {
  const base = { idempotencyKey: 'service-order-key-1234', termsAccepted: true };
  assert.ok(orderCreateSchema.validate({ ...base, paymentMode: 'direct' }).error);
  assert.equal(orderCreateSchema.validate({
    ...base,
    paymentMode: 'direct',
    directPaymentRiskAccepted: true,
  }).error, undefined);
  assert.equal(orderCreateSchema.validate({ ...base, paymentMode: 'escrow' }).error, undefined);
});

test('custom service proposals require risk acknowledgement for direct payment only', () => {
  const base = {
    serviceId: '0123456789abcdef01234567',
    priceNaira: 1000,
    fulfilmentCriteria: 'Provide a complete service.',
    termsAccepted: true,
  };
  assert.ok(serviceOfferCreateSchema.validate({ ...base, paymentMode: 'direct' }).error);
  assert.equal(serviceOfferCreateSchema.validate({
    ...base,
    paymentMode: 'direct',
    directPaymentRiskAccepted: true,
  }).error, undefined);
  assert.equal(serviceOfferCreateSchema.validate({ ...base, paymentMode: 'escrow' }).error, undefined);
});
