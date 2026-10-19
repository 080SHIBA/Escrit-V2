import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockEscrowPreview } from './onboardingMocks.js';

test('mock previews cover each expected link state', () => {
  const cases = [
    ['000000000000000000000001', 'valid'],
    ['000000000000000000000002', 'expired'],
    ['000000000000000000000003', 'cancelled'],
    ['000000000000000000000004', 'already_accepted'],
    ['not-a-mock-link', 'invalid'],
  ];
  for (const [linkId, expectedState] of cases) {
    assert.equal(createMockEscrowPreview(linkId).state, expectedState);
  }
});
