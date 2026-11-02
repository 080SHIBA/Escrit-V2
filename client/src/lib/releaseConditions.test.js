import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RELEASE_WINDOW_HOURS,
  RELEASE_WINDOW_OPTIONS,
  normalizeReleaseWindowHours,
  releaseRuleText,
  releaseWindowLabel,
} from '../shared/releaseConditions.js';
import { deliveryReleaseTime } from '../shared/orderState.js';

test('release windows are a fixed set with the existing 72-hour behavior as default', () => {
  assert.deepEqual(RELEASE_WINDOW_OPTIONS.map(({ hours }) => hours), [24, 72, 168]);
  assert.equal(DEFAULT_RELEASE_WINDOW_HOURS, 72);
  assert.equal(normalizeReleaseWindowHours(), 72);
  assert.equal(releaseWindowLabel(72), '3 days');
});

test('a selected release window controls the automatic release deadline', () => {
  const deliveredAt = new Date('2026-10-19T12:00:00.000Z');

  assert.equal(deliveryReleaseTime(deliveredAt, 24).toISOString(), '2026-10-20T12:00:00.000Z');
  assert.equal(deliveryReleaseTime(deliveredAt, 168).toISOString(), '2026-10-26T12:00:00.000Z');
});

test('release policy explains early buyer confirmation, deadline, and dispute hold', () => {
  const policy = releaseRuleText(24);

  assert.match(policy, /confirm receipt/);
  assert.match(policy, /24 hours after the seller marks delivery/);
  assert.match(policy, /dispute/);
});

test('unsupported release windows are rejected', () => {
  assert.throws(() => normalizeReleaseWindowHours(48), {
    name: 'RangeError',
    message: 'Choose a supported buyer review period.',
  });
});
