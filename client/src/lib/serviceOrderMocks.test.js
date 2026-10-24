import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceOrderMockHandlers } from './serviceOrderMocks.js';

test('service mock availability returns selectable ISO appointment slots', async () => {
  const { slots } = await serviceOrderMockHandlers.availability('mock-listing-11', '2030-05-16');
  assert.equal(slots.length, 3);
  assert.ok(slots.every((slot) => !Number.isNaN(Date.parse(slot))));
});

test('service mock order creation is idempotent for repeated requests', async () => {
  const idempotencyKey = `mock-test-${Date.now()}-booking`;
  const payload = { idempotencyKey, termsAccepted: true, paymentMode: 'escrow', appointmentAt: '2030-05-16T08:00:00.000Z' };
  const first = await serviceOrderMockHandlers.create('mock-listing-11', payload);
  const second = await serviceOrderMockHandlers.create('mock-listing-11', payload);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.order._id, second.order._id);
});

test('direct service mock orders require the risk acknowledgement', async () => {
  await assert.rejects(
    serviceOrderMockHandlers.create('mock-listing-12', {
      idempotencyKey: `mock-test-${Date.now()}-direct`,
      termsAccepted: true,
      paymentMode: 'direct',
    }),
    /Acknowledge the risks/
  );
});

test('service mock appointments keep the original time until the provider confirms a change', async () => {
  const order = await serviceOrderMockHandlers.create('mock-listing-11', {
    idempotencyKey: `mock-test-${Date.now()}-reschedule`,
    termsAccepted: true,
    paymentMode: 'escrow',
    appointmentAt: '2030-05-16T08:00:00.000Z',
  });
  const proposedAt = '2030-05-16T09:30:00.000Z';
  await serviceOrderMockHandlers.update(order.order._id, 'reschedule-request', { appointmentAt: proposedAt });
  const pending = await serviceOrderMockHandlers.list();
  assert.equal(pending.orders.find((entry) => entry._id === order.order._id).appointmentAt, '2030-05-16T08:00:00.000Z');
  await serviceOrderMockHandlers.update(order.order._id, 'reschedule-confirm');
  const confirmed = await serviceOrderMockHandlers.list();
  assert.equal(confirmed.orders.find((entry) => entry._id === order.order._id).appointmentAt, proposedAt);
});

test('quote mocks require a direct-payment acknowledgement and preserve the accepted order', async () => {
  await assert.rejects(
    serviceOrderMockHandlers.createOffer({
      priceNaira: 1200,
      fulfilmentCriteria: 'Prepare a starter brand kit.',
      paymentMode: 'direct',
      termsAccepted: true,
    }),
    /Acknowledge the risks/
  );
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-12',
    priceNaira: 1200,
    fulfilmentCriteria: 'Prepare a starter brand kit.',
    paymentMode: 'escrow',
    termsAccepted: true,
  });
  await serviceOrderMockHandlers.counterOffer(offer._id, { priceNaira: 1500 });
  const accepted = await serviceOrderMockHandlers.acceptOffer(offer._id);
  assert.ok(accepted.orderId);
  assert.equal((await serviceOrderMockHandlers.getOfferMessages(offer._id)).offer.status, 'ACCEPTED');
  assert.match((await serviceOrderMockHandlers.list()).orders.find((entry) => entry._id === accepted.orderId).termsSnapshot, /Escrit escrow was selected/);
});

test('service mock checkout fails explicitly rather than claiming payment succeeded', async () => {
  await assert.rejects(
    serviceOrderMockHandlers.checkout('mock-service-order'),
    /Payment is disabled in local service-order mock mode/
  );
});
