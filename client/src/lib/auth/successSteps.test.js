import test from 'node:test';
import assert from 'node:assert/strict';
import { getSignInSuccessContent, getSignUpNextSteps, getSignUpSuccessContent } from './successSteps.js';

test('sign in success provides the confirmation and dashboard action', () => {
  assert.deepEqual(getSignInSuccessContent(), {
    heading: "You're signed in",
    actionLabel: 'Go to dashboard',
    actionHref: '/dashboard',
  });
});

test('sign up success includes the address and buyer next steps', () => {
  assert.deepEqual(getSignUpSuccessContent('buyer@example.com', ['Buy']), {
    heading: 'Check your inbox',
    email: 'buyer@example.com',
    nextSteps: ['Verify your email', 'Browse the marketplace'],
  });
});

test('buy only success shows email verification and marketplace browsing', () => {
  assert.deepEqual(getSignUpNextSteps(['Buy']), ['Verify your email', 'Browse the marketplace']);
});

test('sell or escrow success adds identity verification and bank setup', () => {
  const sellerSteps = ['Verify your email', 'Verify your identity', 'Add a bank account to get paid'];
  assert.deepEqual(getSignUpNextSteps(['Buy', 'Sell']), sellerSteps);
  assert.deepEqual(getSignUpNextSteps(['Escrow links']), sellerSteps);
});

test('sell or escrow success retains the email and account setup steps', () => {
  const sellerSuccess = getSignUpSuccessContent('seller@example.com', ['Sell']);
  const escrowSuccess = getSignUpSuccessContent('escrow@example.com', ['Escrow links']);
  const sellerSteps = ['Verify your email', 'Verify your identity', 'Add a bank account to get paid'];

  assert.deepEqual(sellerSuccess, {
    heading: 'Check your inbox',
    email: 'seller@example.com',
    nextSteps: sellerSteps,
  });
  assert.deepEqual(escrowSuccess.nextSteps, sellerSteps);
});
