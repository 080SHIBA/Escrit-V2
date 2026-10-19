import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countOrdersByFilter,
  deliveryReleaseTime,
  filterOrders,
  isAutomaticReleaseDue,
  transitionOrder,
} from '../../../shared/orderState.js';

const order = (stage, disputed = false) => ({ stage, disputed });

test('allows the state machine transitions and overlays a dispute without advancing stage', () => {
  assert.equal(transitionOrder(order(0), 'paid', 'system').stage, 1);
  assert.equal(transitionOrder(order(1), 'deliver', 'sell').stage, 2);
  assert.equal(transitionOrder(order(2), 'confirm', 'buy').stage, 3);
  assert.deepEqual(transitionOrder(order(2), 'dispute', 'buy'), { stage: 2, disputed: true });
  assert.deepEqual(transitionOrder(order(1), 'dispute', 'buy'), { stage: 1, disputed: true });
});

test('blocks invalid role, stage, and disputed-order transitions', () => {
  for (const [candidate, action, role] of [
    [order(0), 'deliver', 'sell'],
    [order(1), 'confirm', 'buy'],
    [order(2), 'deliver', 'sell'],
    [order(2), 'confirm', 'sell'],
    [order(3), 'dispute', 'buy'],
    [order(2, true), 'dispute', 'buy'],
    [order(2, true), 'confirm', 'buy'],
    [order(2, true), 'deliver', 'sell'],
  ]) {
    assert.throws(() => transitionOrder(candidate, action, role));
  }
});

test('filters orders and counts each unfiltered status category', () => {
  const orders = [order(0), order(1), order(2), order(3), order(2, true)];
  assert.deepEqual(countOrdersByFilter(orders), {
    All: 5,
    'Awaiting payment': 1,
    'In escrow': 1,
    Delivered: 1,
    Released: 1,
    Disputed: 1,
  });

  test('starts the 72-hour release window at delivery and only releases due held deliveries', () => {
    const deliveredAt = new Date('2025-01-01T12:00:00.000Z');
    const releaseDueAt = deliveryReleaseTime(deliveredAt);
    assert.equal(releaseDueAt.toISOString(), '2025-01-04T12:00:00.000Z');
    const transaction = { status: 'PAID_HELD', fulfillmentStatus: 'DELIVERED', releaseDueAt };
    assert.equal(isAutomaticReleaseDue(transaction, new Date('2025-01-04T11:59:59.000Z')), false);
    assert.equal(isAutomaticReleaseDue(transaction, new Date('2025-01-04T12:00:00.000Z')), true);
    assert.equal(isAutomaticReleaseDue({ ...transaction, status: 'DISPUTED' }, new Date('2025-01-05T00:00:00.000Z')), false);
    assert.equal(isAutomaticReleaseDue({ ...transaction, fulfillmentStatus: 'IN_TRANSIT' }, new Date('2025-01-05T00:00:00.000Z')), false);
  });
  assert.equal(filterOrders(orders, 'Delivered').length, 1);
  assert.equal(filterOrders(orders, 'All').length, orders.length);
});
