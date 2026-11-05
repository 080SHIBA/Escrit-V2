// WHAT: rules for an order's delivery timeline and arrival estimate (pure, no database).
// WHY separate from the route: these rules decide what a seller may post and how the buyer sees
// it, so they are plain functions that are easy to test.

// Order matters: progress only moves forward. 'DELIVERED' is not postable here; it is set by
// marking delivery or by the buyer's signature.
export const TRACKING_STATUSES = Object.freeze(['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'ARRIVED']);
export const TRACKING_LABELS = Object.freeze({
  PROCESSING: 'Seller is preparing your order',
  PACKED: 'Packed and ready',
  SHIPPED: 'On its way',
  OUT_FOR_DELIVERY: 'Out for delivery',
  ARRIVED: 'Arrived, awaiting handover',
  DELIVERED: 'Delivered',
});
const MAX_ESTIMATE_MS = 60 * 24 * 60 * 60 * 1000;

// WHAT: validate a seller's update. Returns { ok, error } .
export function validateTrackingUpdate(transaction, { status, estimatedArrivalAt }, now = new Date()) {
  if (!TRACKING_STATUSES.includes(status)) return { ok: false, error: 'Choose a valid delivery status.' };
  if (['DELIVERED', 'SERVICE_COMPLETE'].includes(transaction.fulfillmentStatus) || transaction.deliverySignature?.signedAt) {
    return { ok: false, error: 'This order is already delivered.' };
  }
  const last = [...(transaction.trackingEvents || [])].reverse().find((event) => TRACKING_STATUSES.includes(event.status));
  if (last && TRACKING_STATUSES.indexOf(status) < TRACKING_STATUSES.indexOf(last.status)) {
    return { ok: false, error: 'Delivery progress cannot go backwards.' };
  }
  if (estimatedArrivalAt) {
    const when = new Date(estimatedArrivalAt).getTime();
    if (!Number.isFinite(when) || when < now.getTime() - 60_000 || when > now.getTime() + MAX_ESTIMATE_MS) {
      return { ok: false, error: 'Choose an arrival estimate between now and 60 days from now.' };
    }
  }
  return { ok: true };
}

// WHAT: the timeline the buyer and seller see: Escrit's own milestones plus the seller's posts.
// WHY merge here: the seller may never post anything (no central courier to force it), so the
// timeline must still show what Escrit itself knows: order placed, payment confirmed, delivered.
export function buildTimeline(transaction) {
  const items = [{ at: transaction.createdAt, status: 'PLACED', label: 'Order placed', source: 'system' }];
  if (transaction.paidAt) items.push({ at: transaction.paidAt, status: 'PAID', label: 'Payment confirmed', source: 'system' });
  for (const event of transaction.trackingEvents || []) {
    items.push({ at: event.at, status: event.status, label: TRACKING_LABELS[event.status] || event.status, note: event.note || '', source: event.source });
  }
  const signedAt = transaction.deliverySignature?.signedAt;
  if (signedAt) {
    items.push({ at: signedAt, status: 'DELIVERED', label: 'Delivered. Confirmed by buyer', note: '', source: 'buyer' });
  } else if (transaction.deliveredAt) {
    items.push({ at: transaction.deliveredAt, status: 'DELIVERED', label: TRACKING_LABELS.DELIVERED, note: 'Marked delivered by the seller', source: 'seller' });
  }
  return items.sort((a, b) => new Date(a.at) - new Date(b.at));
}

// WHAT: true when the seller has posted nothing since the order was paid.
// WHY: the UI uses it to say so plainly ("No updates from the seller yet") instead of looking broken.
export function hasSellerUpdates(transaction) {
  return (transaction.trackingEvents || []).some((event) => event.source === 'seller');
}
