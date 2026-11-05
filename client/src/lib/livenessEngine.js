// WHAT: the pure decision logic of the face check (no camera, no React).
// WHY separate from the UI: these rules decide whether a person passes, so they
// must be exact and testable. The component only feeds in numbers from the camera
// and MediaPipe, and shows what this module says.
//
// FLOW: positioning -> (automatic) -> challenge steps -> done
//   positioning: wait until lighting, face size and position are right and steady.
//   challenge:   prompt the steps the server chose, one at a time (blink, mouth, turn).
//   done:        report a proof. No photo is taken.

export const THRESHOLDS = Object.freeze({
  // Lighting: average brightness of the video frame, 0 (black) to 255 (white).
  // WHY these bounds: below ~70 the landmark model loses the eyes; above ~210 faces
  // wash out or are backlit by a window. The range is generous so ordinary rooms pass.
  minBrightness: 70,
  maxBrightness: 210,
  // Face size as a fraction of the oval's height. Too small = too far away.
  minFaceHeight: 0.55,
  maxFaceHeight: 0.95,
  // How far the face centre may sit from the oval centre (fraction of oval radius).
  maxOffCenter: 0.28,
  // Looking straight: allowed yaw drift from forward.
  maxYawForward: 0.12,
  // Frames (about 100ms each) that all conditions must hold before auto-start. ~1.2s.
  stableFramesToStart: 12,
  // Blendshape scores (0..1) from MediaPipe.
  blinkClosed: 0.55,
  blinkOpen: 0.3,
  mouthOpen: 0.45,
  // Yaw offset that counts as a deliberate head turn.
  turnOffset: 0.2,
  // Time allowed for one prompt before we restart that prompt.
  stepTimeoutMs: 9000,
  // Face may vanish this long before progress on the current prompt is reset.
  faceLostGraceMs: 1500,
});

// WHAT: where a landmark appears inside the on-screen oval box.
// WHY needed: the camera frame is landscape but the oval box is portrait, and the video
// is shown with "object-cover", which crops the sides. Raw landmark coordinates are
// relative to the whole frame, so comparing them to the oval directly (as the old code
// did) judged the face against the wrong area. This converts to what the person sees,
// including the mirror flip of the selfie preview. Returns 0..1 across the box.
export function toBoxCoords(point, video, box) {
  const scale = Math.max(box.width / video.width, box.height / video.height);
  const shownW = video.width * scale;
  const shownH = video.height * scale;
  const offsetX = (shownW - box.width) / 2;
  const offsetY = (shownH - box.height) / 2;
  const x = (point.x * shownW - offsetX) / box.width;
  const y = (point.y * shownH - offsetY) / box.height;
  return { x: 1 - x, y }; // 1 - x: the preview is mirrored like a mirror.
}

// The oval is a perfect ellipse centred in the box: 70% of the width, 86% of the height
// (ratio ~0.81, taller than wide like a real face; the old oval was wider than tall).
export const OVAL = Object.freeze({ cx: 0.5, cy: 0.5, rx: 0.35, ry: 0.43 });

export function insideOval(p, oval = OVAL, grow = 1) {
  const dx = (p.x - oval.cx) / (oval.rx * grow);
  const dy = (p.y - oval.cy) / (oval.ry * grow);
  return dx * dx + dy * dy <= 1;
}

// WHAT: average brightness (0-255) of RGBA pixel data, sampled sparsely.
// WHY sparse: reading every pixel of every frame would be slow on low-end phones.
// Luma weights are the standard perceptual ones (green counts most).
export function averageBrightness(rgba, step = 16) {
  let total = 0;
  let count = 0;
  for (let i = 0; i < rgba.length; i += 4 * step) {
    total += 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    count += 1;
  }
  return count ? total / count : 0;
}

// Yaw proxy: how far the nose sits from the midpoint of the eyes, relative to eye distance.
// WHY: it needs no 3D model. 0 = looking straight; sign tells the turn direction.
export function faceYaw(landmarks) {
  const nose = landmarks[1];
  const a = landmarks[33];
  const b = landmarks[263];
  if (!nose || !a || !b) return null;
  const eyeDistance = Math.abs(a.x - b.x);
  if (eyeDistance < 0.001) return null;
  return (nose.x - (a.x + b.x) / 2) / eyeDistance;
}

export function score(categories = [], name) {
  return categories.find((c) => c.categoryName === name)?.score || 0;
}

// Both eyes together: using the average avoids counting a one-eyed wink or a squint as a blink.
export function blinkAmount(categories) {
  return (score(categories, 'eyeBlinkLeft') + score(categories, 'eyeBlinkRight')) / 2;
}

export function mouthAmount(categories) {
  return score(categories, 'jawOpen');
}

// WHAT: judge one frame for the positioning stage. Returns { ok, hint, metrics }.
// WHY a single hint, in priority order: showing one clear instruction at a time ("Move
// closer") is easier to follow than a list, and the order matches what to fix first.
export function assessPositioning({ landmarks, faceCount, brightness, video, box, yaw, neutralYaw = 0 }) {
  if (!landmarks || faceCount === 0) return { ok: false, hint: 'Place your face inside the oval' };
  if (faceCount > 1) return { ok: false, hint: 'Only one face should be visible' };
  if (brightness < THRESHOLDS.minBrightness) return { ok: false, hint: 'It’s too dark. Move to a brighter spot' };
  if (brightness > THRESHOLDS.maxBrightness) return { ok: false, hint: 'Too bright. Avoid a light behind you' };

  const points = landmarks.map((p) => toBoxCoords(p, video, box));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const height = (maxY - minY) / (2 * OVAL.ry);
  const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (minY + maxY) / 2 };
  const off = Math.hypot((center.x - OVAL.cx) / OVAL.rx, (center.y - OVAL.cy) / OVAL.ry);

  if (height < THRESHOLDS.minFaceHeight) return { ok: false, hint: 'Move a little closer' };
  if (height > THRESHOLDS.maxFaceHeight) return { ok: false, hint: 'Move back a little' };
  if (off > THRESHOLDS.maxOffCenter || !insideOval(center, OVAL, 0.9)) return { ok: false, hint: 'Center your face in the oval' };
  if (Number.isFinite(yaw) && Math.abs(yaw - neutralYaw) > THRESHOLDS.maxYawForward) return { ok: false, hint: 'Look straight at the camera' };
  return { ok: true, hint: 'Hold still…', metrics: { brightness, height, off } };
}

export const STEP_COPY = Object.freeze({
  blink: { prompt: 'Blink your eyes', icon: 'eye' },
  mouth: { prompt: 'Open your mouth', icon: 'mouth' },
  'turn-left': { prompt: 'Slowly turn your head to the left', icon: 'left' },
  'turn-right': { prompt: 'Slowly turn your head to the right', icon: 'right' },
});

export function createChallengeState(steps, now = 0) {
  return {
    steps,
    index: 0,
    stepStartedAt: now,
    // per-step working memory
    blinkOpenSeen: false,
    blinkClosedSeen: false,
    mouthFrames: 0,
    completed: [],
    done: false,
  };
}

// WHAT: advance the challenge with one frame of measurements.
// WHY pure (returns a new state): easy to unit test with fake numbers, and React can
// compare old and new state cheaply.
//
// Turn direction convention: the preview is mirrored, so "left" means the person's own
// left, which appears toward the left of the screen. In the raw camera image a person's
// left side is at larger x, so turning left moves the nose to larger x: offset > 0.
export function advanceChallenge(state, { blink = 0, mouth = 0, yaw = null, neutralYaw = 0, now }) {
  if (state.done) return state;
  const type = state.steps[state.index];
  const next = { ...state };
  let passed = false;

  if (type === 'blink') {
    if (blink <= THRESHOLDS.blinkOpen) next.blinkOpenSeen = true;
    if (next.blinkOpenSeen && blink >= THRESHOLDS.blinkClosed) next.blinkClosedSeen = true;
    // A blink is open -> closed -> open again. Requiring the re-open stops a held-shut eye passing.
    passed = next.blinkClosedSeen && blink <= THRESHOLDS.blinkOpen;
  } else if (type === 'mouth') {
    // Two frames in a row so a single noisy frame cannot pass.
    next.mouthFrames = mouth >= THRESHOLDS.mouthOpen ? state.mouthFrames + 1 : 0;
    passed = next.mouthFrames >= 2;
  } else if (type === 'turn-left' || type === 'turn-right') {
    const offset = Number.isFinite(yaw) ? yaw - neutralYaw : 0;
    passed = type === 'turn-left' ? offset >= THRESHOLDS.turnOffset : offset <= -THRESHOLDS.turnOffset;
  }

  if (passed) {
    next.completed = [...state.completed, { type, completedAt: now }];
    next.index = state.index + 1;
    next.stepStartedAt = now;
    next.blinkOpenSeen = false;
    next.blinkClosedSeen = false;
    next.mouthFrames = 0;
    next.done = next.index >= state.steps.length;
  }
  return next;
}

// True when the current prompt has been showing for too long. The caller then restarts
// that prompt so a hesitant person is never stuck on a dead end.
export function stepTimedOut(state, now) {
  return !state.done && now - state.stepStartedAt > THRESHOLDS.stepTimeoutMs;
}

export function restartStep(state, now) {
  return { ...state, stepStartedAt: now, blinkOpenSeen: false, blinkClosedSeen: false, mouthFrames: 0 };
}

// The report sent to the server. Contains only prompt names and timestamps, never images.
export function buildProof(state) {
  return { version: 1, steps: state.completed.map(({ type, completedAt }) => ({ type, completedAt })) };
}
