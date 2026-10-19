import { deliveryReleaseTime, transitionOrder } from '../../../shared/orderState.js';

const now = Date.now();
const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();

const sellerOrders = [
  { id: 'mock-sell-1', title: 'Handmade leather tote', counterparty: 'Ada Okafor', amount: 48000, stage: 0, disputed: false, deliveredAt: null, releaseDueAt: null, payoutState: 'idle', linkId: 'mock-link-1' },
  { id: 'mock-sell-2', title: 'Studio headphones', counterparty: 'Musa Bello', amount: 72500, stage: 1, disputed: false, deliveredAt: null, releaseDueAt: null, payoutState: 'idle', linkId: 'mock-link-2' },
  { id: 'mock-sell-3', title: 'Ceramic table lamp', counterparty: 'Ifeoma Nwosu', amount: 39500, stage: 2, disputed: false, deliveredAt: hoursAgo(1), releaseDueAt: new Date(now + 71 * 60 * 60 * 1000 + 59 * 60 * 1000).toISOString(), payoutState: 'idle', linkId: 'mock-link-3' },
  { id: 'mock-sell-4', title: 'Oak writing desk', counterparty: 'Tunde James', amount: 190000, stage: 3, disputed: false, deliveredAt: hoursAgo(96), releaseDueAt: hoursAgo(24), payoutState: 'completed', linkId: 'mock-link-4' },
  { id: 'mock-sell-5', title: 'Vintage film camera', counterparty: 'Zara Ali', amount: 112000, stage: 2, disputed: true, deliveredAt: hoursAgo(4), releaseDueAt: new Date(now + 68 * 60 * 60 * 1000).toISOString(), payoutState: 'idle', linkId: 'mock-link-5' },
];

const buyerOrders = [
  { id: 'mock-buy-1', title: 'Linen weekend bag', counterparty: 'Kora Goods', amount: 54000, stage: 1, disputed: false, deliveredAt: null, releaseDueAt: null, linkId: 'mock-link-6' },
  { id: 'mock-buy-2', title: 'Walnut bedside table', counterparty: 'North House', amount: 85000, stage: 2, disputed: false, deliveredAt: hoursAgo(2), releaseDueAt: new Date(now + 70 * 60 * 60 * 1000).toISOString(), linkId: 'mock-link-7' },
];

function cloneOrders(role) {
  return structuredClone(role === 'sell' ? sellerOrders : buyerOrders);
}

function wait() {
  return new Promise((resolve) => window.setTimeout(resolve, 180));
}

export const orderMocksEnabled = import.meta.env.DEV && import.meta.env.VITE_ORDERS_MOCK === 'true';

export const orderMockHandlers = {
  async list(role) {
    await wait();
    return { orders: cloneOrders(role) };
  },
  async action(role, id, action, body = {}) {
    await wait();
    const orders = role === 'sell' ? sellerOrders : buyerOrders;
    const order = orders.find((entry) => entry.id === id);
    if (!order) throw new Error('This order could not be found.');
    const changed = transitionOrder(order, action, role);
    if (action === 'deliver') {
      changed.deliveredAt = new Date().toISOString();
      changed.releaseDueAt = deliveryReleaseTime(changed.deliveredAt).toISOString();
    }
    if (action === 'dispute') changed.disputeReason = body.reason;
    Object.assign(order, changed);
    return { order: { ...order } };
  },
};
