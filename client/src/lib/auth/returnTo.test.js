import test from 'node:test';
import assert from 'node:assert/strict';
import { escrowOnboardingDestination, escrowTransactionPath, getEscrowReturnTo } from './returnTo.js';

test('return targets only accept local escrow paths with object ids', () => {
  assert.equal(getEscrowReturnTo(new URLSearchParams('returnTo=%2Fescrow%2F0123456789abcdef01234567')), '/r/0123456789abcdef01234567');
  assert.equal(getEscrowReturnTo(new URLSearchParams('returnTo=https%3A%2F%2Fevil.example')), '');
});

test('redirects recipient onboarding to the preserved transaction', () => {
  assert.equal(escrowTransactionPath({
    linkId: '0123456789abcdef01234567',
    transactionId: 'abcdef0123456789abcdef01',
  }), '/escrow/0123456789abcdef01234567?transactionId=abcdef0123456789abcdef01');
  assert.equal(escrowOnboardingDestination({ returnTo: '/r/0123456789abcdef01234567' }), '/onboarding');
  assert.equal(escrowOnboardingDestination({}), '/marketplace');
});

test('new email and Google registrations enter onboarding while existing sign-ins go to marketplace', () => {
  assert.equal(escrowOnboardingDestination({ accountCreated: true }), '/onboarding');
  assert.equal(escrowOnboardingDestination({
    accountCreated: true,
    seller: { pendingEscrowReturn: { linkId: '0123456789abcdef01234567' } },
  }), '/onboarding');
  assert.equal(escrowOnboardingDestination({ seller: { email: 'existing@example.test' } }), '/marketplace');
});
