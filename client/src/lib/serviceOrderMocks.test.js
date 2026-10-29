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

test('quote acceptance is idempotent and direct-payment selection requires acknowledgement', async () => {
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-12',
    fulfilmentCriteria: 'Prepare a starter brand kit with a logo and colour palette.',
    termsAccepted: true,
  });
  assert.equal(offer.status, 'REQUESTED');
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Prepare a starter brand kit with logo files and a style guide.',
    deliverables: ['Logo package', 'Style guide'],
    priceNaira: 1500,
    timeline: '10 days',
    revisionLimit: 2,
    paymentMode: 'direct',
  });
  const accepted = await serviceOrderMockHandlers.acceptOffer(offer._id, { termsAccepted: true, actorRole: 'buyer' });
  await assert.rejects(
    serviceOrderMockHandlers.setPaymentOption(offer._id, { paymentMode: 'direct', actorRole: 'buyer' }),
    /Acknowledge the risks/
  );
  await serviceOrderMockHandlers.setPaymentOption(offer._id, {
    paymentMode: 'direct',
    directPaymentRiskAccepted: true,
    actorRole: 'buyer',
  });
  const acceptedAgain = await serviceOrderMockHandlers.acceptOffer(offer._id, { termsAccepted: true, actorRole: 'buyer' });
  assert.ok(accepted.orderId);
  assert.equal(acceptedAgain.orderId, accepted.orderId);
  assert.equal((await serviceOrderMockHandlers.getOfferMessages(offer._id)).offer.status, 'ACCEPTED');
  const order = (await serviceOrderMockHandlers.list()).orders.find((entry) => entry._id === accepted.orderId);
  assert.equal(order.quoteSnapshot.scope, 'Prepare a starter brand kit with logo files and a style guide.');
  assert.match(order.termsSnapshot, /Direct payment goes to the provider/);
});

test('only the seller can quote and only the buyer can accept', async () => {
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-role-check',
    fulfilmentCriteria: 'Create a landing page for a community event.',
    termsAccepted: true,
  });
  await assert.rejects(
    serviceOrderMockHandlers.sendQuote(offer._id, {
      scope: 'Build a responsive community event landing page.',
      priceNaira: 2000,
      timeline: 'One week',
      actorRole: 'buyer',
    }),
    /Only the service provider/
  );
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Build a responsive community event landing page.',
    priceNaira: 2000,
    timeline: 'One week',
    actorRole: 'seller',
  });
  await assert.rejects(
    serviceOrderMockHandlers.acceptOffer(offer._id, { termsAccepted: true, actorRole: 'seller' }),
    /Only the buyer/
  );
});

test('provider confirmation validates amount, currency and status; retries reuse the same order', async () => {
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-payment-check',
    fulfilmentCriteria: 'Prepare a short product photography session.',
    termsAccepted: true,
  });
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Prepare and deliver a short product photography session.',
    priceNaira: 2500,
    timeline: 'Three days',
    paymentMode: 'escrow',
  });
  const accepted = await serviceOrderMockHandlers.acceptOffer(offer._id, { termsAccepted: true });
  const order = accepted.order;
  const payment = {
    transactionId: 'mock-provider-tx-1',
    status: 'success',
    currency: 'NGN',
    amountKobo: order.amountKobo,
  };
  await assert.rejects(serviceOrderMockHandlers.verifyPayment(order._id, { ...payment, amountKobo: 1 }), /could not be verified/);
  await assert.rejects(serviceOrderMockHandlers.verifyPayment(order._id, { ...payment, currency: 'USD' }), /could not be verified/);
  await assert.rejects(serviceOrderMockHandlers.verifyPayment(order._id, { ...payment, status: 'pending' }), /could not be verified/);
  const confirmed = await serviceOrderMockHandlers.verifyPayment(order._id, payment);
  const retried = await serviceOrderMockHandlers.verifyPayment(order._id, payment);
  assert.equal(confirmed.created, true);
  assert.equal(retried.created, false);
  assert.equal(retried.order._id, confirmed.order._id);
  assert.equal(retried.order.status, 'ready_to_start');
});

test('service order transitions enforce seller and buyer roles and release escrow on completion', async () => {
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-lifecycle',
    fulfilmentCriteria: 'Design a small set of social media graphics.',
    termsAccepted: true,
  });
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Design a small set of social media graphics.',
    priceNaira: 1200,
    timeline: 'Five days',
    paymentMode: 'escrow',
  });
  const accepted = await serviceOrderMockHandlers.acceptOffer(offer._id, { termsAccepted: true });
  await serviceOrderMockHandlers.confirmMockPayment(accepted.orderId);
  await assert.rejects(
    serviceOrderMockHandlers.update(accepted.orderId, 'start', { actorRole: 'buyer' }),
    /Only the provider/
  );
  await serviceOrderMockHandlers.update(accepted.orderId, 'start', { actorRole: 'seller' });
  await serviceOrderMockHandlers.update(accepted.orderId, 'deliver', {
    actorRole: 'seller',
    note: 'Your graphics are ready.',
  });
  await serviceOrderMockHandlers.update(accepted.orderId, 'accept', { actorRole: 'buyer' });
  const completed = (await serviceOrderMockHandlers.list()).orders.find((item) => item._id === accepted.orderId);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.paymentStatus, 'released');
});

test('escrow disputes require a paid order and valid buyer reason', async () => {
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-dispute',
    fulfilmentCriteria: 'Repair a damaged wooden chair.',
    termsAccepted: true,
  });
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Repair a damaged wooden chair and refinish the frame.',
    priceNaira: 1800,
    timeline: 'Four days',
    paymentMode: 'escrow',
  });
  const accepted = await serviceOrderMockHandlers.acceptOffer(offer._id, { termsAccepted: true });
  await serviceOrderMockHandlers.confirmMockPayment(accepted.orderId);
  await assert.rejects(
    serviceOrderMockHandlers.update(accepted.orderId, 'dispute', { actorRole: 'seller', reason: 'Missing work' }),
    /Only the buyer/
  );
  await assert.rejects(
    serviceOrderMockHandlers.update(accepted.orderId, 'dispute', { actorRole: 'buyer', reason: 'bad' }),
    /short reason/
  );
  const disputed = await serviceOrderMockHandlers.update(accepted.orderId, 'dispute', {
    actorRole: 'buyer',
    reason: 'The provider has not completed the agreed repair.',
  });
  assert.equal(disputed.order.status, 'disputed');
});

test('conversation creation and optimistic messages are idempotent', async () => {
  const payload = {
    serviceId: 'mock-listing-chat-idempotency',
    sellerId: 'mock-seller-2',
    termsAccepted: true,
    fulfilmentCriteria: 'I would like to ask about this service.',
  };
  const first = await serviceOrderMockHandlers.openConversation(payload);
  const second = await serviceOrderMockHandlers.openConversation(payload);
  assert.equal(second.created, false);
  assert.equal(second.offer._id, first.offer._id);
  const initialCount = (await serviceOrderMockHandlers.getOfferMessages(first.offer._id)).messages.length;
  const firstMessage = await serviceOrderMockHandlers.sendOfferMessage(first.offer._id, 'Could you share more details?', 'client-msg-1', 'buyer');
  const retryMessage = await serviceOrderMockHandlers.sendOfferMessage(first.offer._id, 'Could you share more details?', 'client-msg-1', 'buyer');
  assert.equal(retryMessage.message._id, firstMessage.message._id);
  assert.equal((await serviceOrderMockHandlers.getOfferMessages(first.offer._id)).messages.length, initialCount + 1);
});

test('mock provider failure does not mark an order paid', async () => {
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-payment-failure',
    fulfilmentCriteria: 'Prepare a short consultation session.',
    termsAccepted: true,
  });
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Prepare a short consultation session.',
    priceNaira: 1500,
    timeline: 'Two days',
    paymentMode: 'escrow',
  });
  const accepted = await serviceOrderMockHandlers.acceptOffer(offer._id, { termsAccepted: true });
  await assert.rejects(serviceOrderMockHandlers.confirmMockPayment(accepted.orderId, 'failure'), /could not confirm/);
  const order = (await serviceOrderMockHandlers.list()).orders.find((item) => item._id === accepted.orderId);
  assert.equal(order.paymentStatus, 'unpaid');
});

test('buyer quote changes return to the provider for an updated quote', async () => {
  const { offer } = await serviceOrderMockHandlers.createOffer({
    serviceId: 'mock-listing-13',
    fulfilmentCriteria: 'Plan a small community workshop.',
    termsAccepted: true,
  });
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Plan a small community workshop, including venue and schedule.',
    priceNaira: 3000,
    timeline: 'Three weeks',
    paymentMode: 'escrow',
  });
  await serviceOrderMockHandlers.requestQuoteChanges(offer._id, 'Please include attendee materials.');
  await serviceOrderMockHandlers.sendQuote(offer._id, {
    scope: 'Plan the workshop and provide attendee materials.',
    priceNaira: 3500,
    timeline: 'Three weeks',
    paymentMode: 'escrow',
  });
  const refreshed = await serviceOrderMockHandlers.getOfferMessages(offer._id);
  assert.equal(refreshed.offer.status, 'QUOTED');
  assert.equal(refreshed.offer.currentPriceKobo, 350000);
  assert.equal(refreshed.offer.changeRequest.status, 'accepted');
});

test('service mock checkout fails explicitly rather than claiming payment succeeded', async () => {
  await assert.rejects(
    serviceOrderMockHandlers.checkout('mock-service-order'),
    /Payment is disabled in local service-order mock mode/
  );
});
