// WHAT: small display helpers for tracking (pure, so they can be tested).
export function formatEta(iso, now = new Date()) {
  if (!iso) return 'Not set by the seller yet';
  const when = new Date(iso);
  const days = Math.round((when - now) / 86_400_000);
  const date = when.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
  if (days < 0) return `Was expected ${date}`;
  if (days === 0) return `Today (${date})`;
  if (days === 1) return `Tomorrow (${date})`;
  return `In ${days} days (${date})`;
}

// Only products have tracked, signed deliveries, and only once paid.
export function showsTracking(order) {
  return order?.listingType === 'product' && !['CREATED'].includes(order.status) && Boolean(order.trackingCode);
}

// WHAT: turn a full receipt URL from the server into an in-app path.
// WHY: the server builds the absolute link (for emails); inside the app we navigate with the router.
export function receiptPath(url) {
  try { return new URL(url).pathname; } catch { return url || ''; }
}
