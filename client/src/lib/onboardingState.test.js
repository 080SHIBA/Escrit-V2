import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOnboardingSteps, createInitialOnboarding, getPrimaryGoal } from './onboardingState.js';

test('new-user flow computes optional steps and updates total from selected goals', () => {
  const state = createInitialOnboarding();
  assert.deepEqual(computeOnboardingSteps(state), ['welcome', 'buy', 'trust', 'done']);

  state.goals = ['Buy', 'Sell', 'Escrow'];
  state.sellerTypes = ['Products'];
  assert.deepEqual(computeOnboardingSteps(state), [
    'welcome', 'buy', 'sell1', 'sell2', 'sell3', 'escrow', 'trust', 'done',
  ]);
});

test('the step count responds to the live goal and product choices', () => {
  const state = createInitialOnboarding({ goals: ['Buy', 'Sell'], sellerTypes: ['Products'] });
  assert.equal(computeOnboardingSteps(state).length, 7);
  state.sellerTypes = [];
  assert.equal(computeOnboardingSteps(state).length, 6);
  state.goals = ['Buy'];
  assert.deepEqual(computeOnboardingSteps(state), ['welcome', 'buy', 'trust', 'done']);
});

test('fulfilment appears only when selling physical products', () => {
  const state = createInitialOnboarding({ goals: ['Sell'], sellerTypes: ['Services'] });
  assert.equal(computeOnboardingSteps(state).includes('sell2'), false);
  state.sellerTypes = ['Products'];
  assert.equal(computeOnboardingSteps(state).includes('sell2'), true);
});

test('escrow-link flow is data-defined separately from new-user onboarding', () => {
  assert.deepEqual(computeOnboardingSteps(createInitialOnboarding({ flow: 'escrow-link' })), ['escrow-welcome', 'escrow-preview']);
});

test('primary action prioritizes selling, then escrow, then shopping', () => {
  assert.equal(getPrimaryGoal(createInitialOnboarding({ goals: ['Buy', 'Escrow'] })), 'escrow');
  assert.equal(getPrimaryGoal(createInitialOnboarding({ goals: ['Buy', 'Sell', 'Escrow'] })), 'sell');
});
