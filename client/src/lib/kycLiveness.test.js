import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivenessState, updateLivenessState } from './kycLiveness.js';

test('liveness check completes after an open-close-open blink', () => {
  let state = createLivenessState();
  state = updateLivenessState(state, { faceDetected: true, blinkScore: 0.1, yaw: 0 });
  state = updateLivenessState(state, { faceDetected: true, blinkScore: 0.8, yaw: 0 });
  state = updateLivenessState(state, { faceDetected: true, blinkScore: 0.1, yaw: 0 });
  assert.equal(state.blinkDetected, true);
  assert.equal(state.complete, true);
});

test('liveness check completes after turning the head in both directions', () => {
  let state = createLivenessState();
  for (let frame = 0; frame < 8; frame += 1) {
    state = updateLivenessState(state, { faceDetected: true, blinkScore: 0.1, yaw: 0 });
  }
  state = updateLivenessState(state, { faceDetected: true, blinkScore: 0.1, yaw: -0.2 });
  assert.equal(state.complete, false);
  state = updateLivenessState(state, { faceDetected: true, blinkScore: 0.1, yaw: 0.2 });
  assert.equal(state.turnedLeft, true);
  assert.equal(state.turnedRight, true);
  assert.equal(state.complete, true);
});

test('face loss does not clear completed liveness progress', () => {
  const complete = {
    ...createLivenessState(),
    faceDetected: true,
    blinkDetected: true,
    complete: true,
  };
  const state = updateLivenessState(complete, { faceDetected: false });
  assert.equal(state.complete, true);
  assert.equal(state.faceDetected, false);
});
