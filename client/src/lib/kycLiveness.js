export function createLivenessState() {
  return {
    faceDetected: false,
    calibrationFrames: 0,
    yawTotal: 0,
    neutralYaw: null,
    eyesOpened: false,
    eyesClosed: false,
    blinkDetected: false,
    turnedLeft: false,
    turnedRight: false,
    complete: false,
  };
}

export function updateLivenessState(state, { faceDetected, blinkScore = 0, yaw = null }) {
  if (!faceDetected) {
    return state.faceDetected ? { ...state, faceDetected: false } : state;
  }

  const next = { ...state, faceDetected: true };
  if (Number.isFinite(yaw) && state.neutralYaw === null) {
    next.calibrationFrames = Math.min(state.calibrationFrames + 1, 8);
    next.yawTotal = state.yawTotal + yaw;
    if (next.calibrationFrames === 8) next.neutralYaw = next.yawTotal / 8;
  } else if (Number.isFinite(yaw) && state.neutralYaw !== null) {
    const offset = yaw - state.neutralYaw;
    if (offset <= -0.18) next.turnedLeft = true;
    if (offset >= 0.18) next.turnedRight = true;
  }

  if (blinkScore <= 0.25) next.eyesOpened = true;
  if (next.eyesOpened && blinkScore >= 0.65) next.eyesClosed = true;
  if (next.eyesClosed && blinkScore <= 0.35) next.blinkDetected = true;
  next.complete = next.blinkDetected || (next.turnedLeft && next.turnedRight);

  return Object.keys(next).every((key) => next[key] === state[key]) ? state : next;
}
