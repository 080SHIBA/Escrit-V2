import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeServiceReservationStatuses,
  localDateTimeToUtc,
  overlaps,
  slotReservationKeys,
} from './serviceAvailability.js';

test('converts service-local appointment times to UTC', () => {
  assert.equal(
    localDateTimeToUtc('2025-01-15', '09:00', 'Africa/Lagos').toISOString(),
    '2025-01-15T08:00:00.000Z'
  );
});

test('rejects local times missing during a daylight-saving transition', () => {
  assert.equal(localDateTimeToUtc('2025-03-09', '02:30', 'America/New_York'), null);
});

test('appointment reservations lock every 15-minute slot including buffer time', () => {
  assert.deepEqual(
    slotReservationKeys('2025-01-15T09:00:00.000Z', 60, 15),
    [
      '2025-01-15T09:00:00.000Z',
      '2025-01-15T09:15:00.000Z',
      '2025-01-15T09:30:00.000Z',
      '2025-01-15T09:45:00.000Z',
      '2025-01-15T10:00:00.000Z',
    ]
  );
});

test('uses half-open overlap intervals and includes paid service work as reserved', () => {
  assert.equal(overlaps('2025-01-15T09:00:00Z', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z', '2025-01-15T11:00:00Z'), false);
  assert.equal(overlaps('2025-01-15T09:00:00Z', '2025-01-15T10:00:00Z', '2025-01-15T09:45:00Z', '2025-01-15T10:45:00Z'), true);
  assert.ok(activeServiceReservationStatuses().includes('in_progress'));
});
