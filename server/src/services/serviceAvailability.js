const SLOT_GRANULARITY_MINUTES = 15;
const ACTIVE_RESERVATION_STATUSES = ['pending_approval', 'awaiting_payment', 'confirmed', 'ready_to_start', 'in_progress', 'delivered', 'revision_requested', 'completed'];

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]));
}

export function localDateTimeToUtc(dateText, timeText, timeZone) {
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desired;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    candidate += desired - represented;
  }

  const result = new Date(candidate);
  const actual = zonedParts(result, timeZone);
  if (
    actual.year !== year || actual.month !== month || actual.day !== day
    || actual.hour !== hour || actual.minute !== minute
  ) return null;
  return result;
}

export function slotReservationKeys(startAt, durationMinutes, bufferMinutes = 0) {
  const start = new Date(startAt).getTime();
  const end = start + (durationMinutes + bufferMinutes) * 60_000;
  const first = Math.floor(start / (SLOT_GRANULARITY_MINUTES * 60_000)) * SLOT_GRANULARITY_MINUTES * 60_000;
  const keys = [];
  for (let timestamp = first; timestamp < end; timestamp += SLOT_GRANULARITY_MINUTES * 60_000) {
    keys.push(new Date(timestamp).toISOString());
  }
  return keys;
}

export function allocateSlotReservationLane(baseKeys, orders, capacity) {
  const occupied = new Set();
  for (const order of orders) {
    for (const key of order.slotKeys || []) {
      const separator = key.lastIndexOf('|capacity:');
      const slotKey = key.slice(0, separator < 0 ? undefined : separator);
      const lane = separator < 0 ? 0 : Number(key.slice(separator + 10));
      occupied.add(`${slotKey}|${lane}`);
    }
  }
  for (let lane = 0; lane < capacity; lane += 1) {
    if (baseKeys.every((key) => !occupied.has(`${key}|${lane}`))) {
      return baseKeys.map((key) => `${key}|capacity:${lane}`);
    }
  }
  return null;
}

export function overlaps(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);
}

export function activeServiceReservationStatuses() {
  return [...ACTIVE_RESERVATION_STATUSES];
}
