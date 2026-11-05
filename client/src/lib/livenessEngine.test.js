import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceChallenge, assessPositioning, averageBrightness, createChallengeState, insideOval, restartStep, stepTimedOut, toBoxCoords, OVAL, THRESHOLDS } from './livenessEngine.js';

// A face-sized cloud of landmarks centred at (cx, cy) with the given height, in raw frame coordinates.
function face(cx, cy, h) {
  const w = h * 0.7;
  const pts = Array.from({ length: 468 }, () => ({ x: cx, y: cy }));
  pts[10] = { x: cx, y: cy - h / 2 };
  pts[152] = { x: cx, y: cy + h / 2 };
  pts[234] = { x: cx - w / 2, y: cy };
  pts[454] = { x: cx + w / 2, y: cy };
  pts[1] = { x: cx, y: cy };
  pts[33] = { x: cx - 0.05, y: cy - 0.05 };
  pts[263] = { x: cx + 0.05, y: cy - 0.05 };
  return pts;
}
const video = { width: 1280, height: 720 };
const box = { width: 300, height: 400 };

test('the oval is taller than wide', () => { assert.ok(OVAL.ry > OVAL.rx); });
test('box mapping crops landscape video and mirrors', () => {
  const left = toBoxCoords({ x: 0.5, y: 0.5 }, video, box);
  assert.ok(Math.abs(left.x - 0.5) < 1e-9 && Math.abs(left.y - 0.5) < 1e-9);
  const m = toBoxCoords({ x: 0.55, y: 0.5 }, video, box);
  assert.ok(m.x < 0.5, 'a point right of centre in the raw frame appears left in the mirror');
});
test('insideOval', () => { assert.equal(insideOval({ x: 0.5, y: 0.5 }), true); assert.equal(insideOval({ x: 0.95, y: 0.5 }), false); });
test('brightness average', () => { assert.equal(Math.round(averageBrightness(new Uint8ClampedArray(64).fill(255))), 255); });

// Face height in frame coords: the oval is 0.86 of box height; box height maps to 720/ (scale) ... choose raw h so box fraction ≈ 0.7.
const rawH = (0.7 * box.height) / (Math.max(box.width / video.width, box.height / video.height) * video.height);
test('positioning hints in priority order', () => {
  const ok = { landmarks: face(0.5, 0.5, rawH), faceCount: 1, brightness: 130, video, box, yaw: 0 };
  assert.equal(assessPositioning(ok).ok, true);
  assert.match(assessPositioning({ ...ok, landmarks: null, faceCount: 0 }).hint, /oval/);
  assert.match(assessPositioning({ ...ok, faceCount: 2 }).hint, /one face/i);
  assert.match(assessPositioning({ ...ok, brightness: 30 }).hint, /dark/i);
  assert.match(assessPositioning({ ...ok, brightness: 250 }).hint, /bright/i);
  assert.match(assessPositioning({ ...ok, landmarks: face(0.5, 0.5, rawH * 0.4) }).hint, /closer/);
  assert.match(assessPositioning({ ...ok, landmarks: face(0.5, 0.5, rawH * 1.5) }).hint, /back/);
  assert.match(assessPositioning({ ...ok, landmarks: face(0.52, 0.5, rawH) , yaw: 0.5 }).hint, /straight/);
});

test('blink needs open, closed, open again', () => {
  let s = createChallengeState(['blink'], 0);
  s = advanceChallenge(s, { blink: 0.1, now: 1 });
  s = advanceChallenge(s, { blink: 0.8, now: 2 });
  assert.equal(s.done, false);
  s = advanceChallenge(s, { blink: 0.1, now: 3 });
  assert.equal(s.done, true);
});
test('eyes held shut never pass', () => {
  let s = createChallengeState(['blink'], 0);
  s = advanceChallenge(s, { blink: 0.9, now: 1 });
  s = advanceChallenge(s, { blink: 0.9, now: 2 });
  assert.equal(s.done, false);
});
test('mouth needs two consecutive frames', () => {
  let s = createChallengeState(['mouth'], 0);
  s = advanceChallenge(s, { mouth: 0.9, now: 1 });
  s = advanceChallenge(s, { mouth: 0.1, now: 2 });
  s = advanceChallenge(s, { mouth: 0.9, now: 3 });
  assert.equal(s.done, false);
  s = advanceChallenge(s, { mouth: 0.9, now: 4 });
  assert.equal(s.done, true);
});
test('turn direction is respected relative to neutral', () => {
  let s = createChallengeState(['turn-left'], 0);
  s = advanceChallenge(s, { yaw: -0.4, neutralYaw: 0, now: 1 });
  assert.equal(s.done, false);
  s = advanceChallenge(s, { yaw: 0.3, neutralYaw: 0, now: 2 });
  assert.equal(s.done, true);
  let r = createChallengeState(['turn-right'], 0);
  r = advanceChallenge(r, { yaw: -0.3, neutralYaw: 0, now: 1 });
  assert.equal(r.done, true);
});
test('steps run in the requested order and are recorded', () => {
  let s = createChallengeState(['mouth', 'blink'], 0);
  s = advanceChallenge(s, { blink: 0.1, now: 1 });
  s = advanceChallenge(s, { blink: 0.9, now: 2 });
  s = advanceChallenge(s, { blink: 0.1, now: 3 });
  assert.equal(s.index, 0, 'a blink must not satisfy the mouth prompt');
  s = advanceChallenge(s, { mouth: 0.9, now: 4 });
  s = advanceChallenge(s, { mouth: 0.9, now: 5 });
  assert.equal(s.index, 1);
  assert.deepEqual(s.completed.map((c) => c.type), ['mouth']);
});
test('timeout and restart', () => {
  const s = createChallengeState(['blink'], 0);
  assert.equal(stepTimedOut(s, THRESHOLDS.stepTimeoutMs + 1), true);
  assert.equal(stepTimedOut(restartStep(s, 10000), 10001), false);
});
