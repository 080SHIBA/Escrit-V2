export const DEFAULT_RELEASE_WINDOW_HOURS = 72;

export const RELEASE_WINDOW_OPTIONS = Object.freeze([
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days', recommended: true },
  { hours: 168, label: '7 days' },
]);

export function normalizeReleaseWindowHours(hours = DEFAULT_RELEASE_WINDOW_HOURS) {
  if (hours == null) return DEFAULT_RELEASE_WINDOW_HOURS;
  if (!RELEASE_WINDOW_OPTIONS.some((option) => option.hours === Number(hours))) {
    throw new RangeError('Choose a supported buyer review period.');
  }
  return Number(hours);
}

export function releaseWindowLabel(hours = DEFAULT_RELEASE_WINDOW_HOURS) {
  const normalizedHours = normalizeReleaseWindowHours(hours);
  return RELEASE_WINDOW_OPTIONS.find((option) => option.hours === normalizedHours).label;
}

export function releaseRuleText(hours = DEFAULT_RELEASE_WINDOW_HOURS, fulfillmentType = 'product') {
  const completion = fulfillmentType === 'product'
    ? 'confirm receipt and that the item matches the agreed condition'
    : 'confirm the agreed fulfilment is complete';
  const deadline = fulfillmentType === 'product' ? 'marks delivery' : 'marks fulfilment complete';
  return `The buyer can ${completion} to release funds early. Otherwise, funds automatically release ${releaseWindowLabel(hours)} after the seller ${deadline}. If the buyer raises a dispute before then, funds stay on hold while it is reviewed.`;
}
