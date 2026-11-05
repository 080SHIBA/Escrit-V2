// WHAT: server-issued liveness challenges and the check of what the browser reports back.
//
// WHY the server is involved at all: the face analysis runs in the browser (video
// never leaves the device, which is good for privacy and cost). But anything the
// browser reports can be faked by someone calling our API directly. We cannot make
// that impossible without a paid server-side face service, yet we can make it much
// harder and give admins something trustworthy to review:
//   1. The server picks the prompts (blink, open mouth, turn which way, in which
//      order). A pre-recorded or scripted answer cannot know them in advance.
//   2. The session is signed and expires after 15 minutes, so it cannot be hoarded.
//   3. Each session can be used once (replay protection).
//   4. The reported timings must be physically plausible (a human cannot blink,
//      open their mouth and turn their head in 300 milliseconds).
// This is a strong deterrent against casual abuse. For high-value fraud, add a
// vendor-grade check later; this module is the seam where that would plug in.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

// WHY 15 minutes: after the face check, KYC continues with the ID upload, which can take a while
// on a slow connection. Each session is still single-use and bound to one user.
const SESSION_TTL_SECONDS = 15 * 60;
// WHY these minimums: a real person needs roughly half a second per action even when
// quick. Anything faster than this is a script, not a face.
const MIN_STEP_MS = 400;
const MIN_TOTAL_MS = 2500;
const STEP_KINDS = ['blink', 'mouth'];
const TURNS = ['turn-left', 'turn-right'];

// WHY a derived secret: tokens for liveness must not be usable as login tokens (or the
// reverse), so we sign them with a key derived from the app secret plus a purpose label.
function signingKey() {
  return crypto.createHmac('sha256', env.jwt.accessSecret)
    .update('escrit-liveness-v1')
    .digest();
}

// WHAT: build the random prompt list: blink, mouth and one head turn, shuffled.
// WHY three and mixed: three different muscle groups are hard to spoof with a single
// looping clip, while still taking only a few seconds for a genuine person.
export function buildChallenges() {
  const turn = TURNS[crypto.randomInt(TURNS.length)];
  const steps = [...STEP_KINDS, turn];
  for (let i = steps.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [steps[i], steps[j]] = [steps[j], steps[i]];
  }
  return steps;
}

export function issueLivenessSession(userId, purpose = 'kyc') {
  const steps = buildChallenges();
  const sessionId = crypto.randomUUID();
  const token = jwt.sign({ sub: String(userId), jti: sessionId, steps, purpose }, signingKey(), { expiresIn: SESSION_TTL_SECONDS });
  return { token, sessionId, steps, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString() };
}

// WHAT: validate a finished liveness attempt. Returns { sessionId, steps, totalMs }.
// WHY it does not mark the session used: the caller stores `sessionId` with its own
// record (KYC submission, delivery signature) and checks for an existing one, which keeps
// "used once" correct across several server instances without shared memory.
export function verifyLivenessProof({ token, proof, userId, purpose = 'kyc' }) {
  let claims;
  try {
    claims = jwt.verify(String(token || ''), signingKey());
  } catch {
    throw new AppError(400, 'The face check expired. Please run it again.');
  }
  if (claims.sub !== String(userId) || claims.purpose !== purpose) {
    throw new AppError(400, 'The face check does not belong to this request. Please run it again.');
  }
  let parsed = proof;
  if (typeof proof === 'string') {
    try { parsed = JSON.parse(proof); } catch { parsed = null; }
  }
  const reported = Array.isArray(parsed?.steps) ? parsed.steps : [];
  if (reported.length !== claims.steps.length || reported.some((step, index) => step?.type !== claims.steps[index])) {
    throw new AppError(400, 'The face check was not completed in the requested order. Please run it again.');
  }
  const issuedAtMs = claims.iat * 1000;
  let previous = issuedAtMs;
  let totalMs = 0;
  for (const step of reported) {
    const completedAt = Number(step.completedAt);
    // WHY a few seconds of tolerance: the browser clock and server clock rarely agree exactly.
    if (!Number.isFinite(completedAt) || completedAt > Date.now() + 5000) {
      throw new AppError(400, 'The face check timing looked wrong. Please run it again.');
    }
    const took = completedAt - previous;
    if (took < MIN_STEP_MS) throw new AppError(400, 'The face check finished too quickly. Please run it again.');
    totalMs += took;
    previous = completedAt;
  }
  if (totalMs < MIN_TOTAL_MS) throw new AppError(400, 'The face check finished too quickly. Please run it again.');
  return { sessionId: claims.jti, steps: claims.steps, totalMs };
}
