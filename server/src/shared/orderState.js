export const ORDER_STAGES = Object.freeze([
  'Awaiting payment',
  'In escrow',
  'Delivered',
  'Released',
]);

export const ORDER_FILTERS = Object.freeze([
  'All',
  'Awaiting payment',
  'In escrow',
  'Delivered',
  'Released',
  'Disputed',
]);

import { DEFAULT_RELEASE_WINDOW_HOURS, normalizeReleaseWindowHours } from './releaseConditions.js';

const ORDER_LISTING_TYPES = new Set(['product', 'service', 'course']);

export function orderListingType(order) {
  if (ORDER_LISTING_TYPES.has(order?.listingType)) return order.listingType;
  if (ORDER_LISTING_TYPES.has(order?.fulfillmentType)) return order.fulfillmentType;
  return 'product';
}

export const DELIVERY_RELEASE_MS = DEFAULT_RELEASE_WINDOW_HOURS * 60 * 60 * 1000;

export function deliveryReleaseTime(deliveredAt, releaseWindowHours = DEFAULT_RELEASE_WINDOW_HOURS) {
  const releaseWindowMs = normalizeReleaseWindowHours(releaseWindowHours) * 60 * 60 * 1000;
  return new Date(new Date(deliveredAt).getTime() + releaseWindowMs);
}

export function isAutomaticReleaseDue(transaction, now = new Date()) {
  return transaction.status === 'PAID_HELD' &&
    ['DELIVERED', 'SERVICE_COMPLETE'].includes(transaction.fulfillmentStatus) &&
    Boolean(transaction.releaseDueAt) &&
    new Date(transaction.releaseDueAt) <= now;
}

export function orderStage(order) {
  if (order.disputed) return Math.max(1, Math.min(2, Number(order.stage) || 1));
  return Math.max(0, Math.min(3, Number(order.stage) || 0));
}

export function orderFilter(order) {
  if (order.disputed) return 'Disputed';
  return ORDER_STAGES[orderStage(order)];
}

export function filterOrders(orders, filter) {
  return filter === 'All' ? orders : orders.filter((order) => orderFilter(order) === filter);
}

export function countOrdersByFilter(orders) {
  return Object.fromEntries(ORDER_FILTERS.map((filter) => [
    filter,
    filter === 'All' ? orders.length : orders.filter((order) => orderFilter(order) === filter).length,
  ]));
}

export function transitionOrder(order, action, role) {
  const stage = orderStage(order);
  if (order.disputed) {
    throw new Error('Disputed orders are frozen until the dispute is resolved.');
  }

  if (action === 'paid' && role === 'system' && stage === 0) {
    return { ...order, stage: 1 };
  }
  if (action === 'deliver' && role === 'sell' && stage === 1) {
    return { ...order, stage: 2 };
  }
  if (action === 'confirm' && role === 'buy' && stage === 2) {
    return { ...order, stage: 3 };
  }
  if (action === 'dispute' && role === 'buy' && stage >= 1 && stage <= 2) {
    return { ...order, disputed: true };
  }
  throw new Error('That action is not available for this order.');
}
