import { useCallback, useEffect, useRef, useState } from 'react';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { CheckCircleIcon } from './icons.jsx';
import { useCameraStream } from '../hooks/useCameraStream.js';
import { cameraProblem } from '../lib/cameraErrors.js';
import {
  OVAL, STEP_COPY, THRESHOLDS, advanceChallenge, assessPositioning, averageBrightness, blinkAmount,
  buildProof, createChallengeState, faceYaw, mouthAmount, restartStep, stepTimedOut,
} from '../lib/livenessEngine.js';

// WHAT: the guided face check. The person opens it, positions their face in a tall oval,
// and once lighting, distance and position are right it STARTS ON ITS OWN, prompts a
// few actions (blink, open mouth, turn head), and reports success the moment they are
// done. No button to capture, and no photo is taken.
//
// Props:
//   fetchSession: async () => ({ token, steps })  gets the server-chosen prompts
//   onVerified:   ({ token, proof }) => void       called once when every prompt passed
//   onCancel:     optional
//
// WHY MediaPipe runs here: video frames are analysed on the device, so video never leaves it
// (privacy) and there is no per-frame server cost.

const WASM_FILESET = { wasmLoaderPath, wasmBinaryPath };
const MODEL_PATH = '/models/face_landmarker.task';

// WHAT: load the face model once and share it.
// WHY a module-level promise: the model is ~4 MB. Starting the download as soon as the
// component appears (before the person taps anything) hides most of the wait, and a retake
// reuses the same loaded model instead of downloading again.
let landmarkerPromise = null;
function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode: 'VIDEO',
        numFaces: 2, // 2 so we can notice (and refuse) a second face in frame
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputFaceBlendshapes: true,
      });
      // WHY GPU first: faster on phones. WHY CPU fallback: the GPU path fails on some devices.
      try { return await FaceLandmarker.createFromOptions(WASM_FILESET, options('GPU')); } catch { return FaceLandmarker.createFromOptions(WASM_FILESET, options('CPU')); }
    })().catch((error) => { landmarkerPromise = null; error.code = 'model'; throw error; });
  }
  return landmarkerPromise;
}

const RING = { idle: '#ffffff', warn: '#f5b942', go: '#34c38f' };

export default function FaceLivenessCheck({ fetchSession, onVerified, onCancel, autoStartIfAllowed = true, completed = false }) {
  const videoRef = useRef(null);
  const boxRef = useRef(null);
  const probeRef = useRef(null);
  const camera = useCameraStream(videoRef);
  const [stage, setStage] = useState(completed ? 'done' : 'intro'); // intro | positioning | challenge | done | problem
  const [hint, setHint] = useState('');
  const [problem, setProblem] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [ring, setRing] = useState('idle');
  const session = useRef(null);
  const loopRef = useRef({ active: false });

  const loadSession = useCallback(async () => {
    const result = await fetchSession();
    session.current = result;
    return result;
  }, [fetchSession]);

  // Begin downloading the model right away so it is ready when the camera opens.
  useEffect(() => { loadLandmarker().catch(() => {}); }, []);

  const stopAll = useCallback(() => { loopRef.current.active = false; camera.stop(); }, [camera]);

  const begin = useCallback(async () => {
    setProblem(null);
    setHint('');
    setStage('positioning');
    try {
      // WHY in parallel: the permission prompt, the model download and the session request are
      // independent, so waiting for them one by one would add several seconds.
      const [ok, , landmarker] = await Promise.all([camera.start(), loadSession(), loadLandmarker()]);
      if (!ok) return;
      runLoop(landmarker, session.current.steps);
    } catch (error) {
      stopAll();
      setProblem(cameraProblem(error?.code === 'model' ? 'model' : 'unknown', navigator.userAgent));
      setStage('problem');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, loadSession, stopAll]);

  // Camera ended up denied/busy/etc: show the matching explanation.
  useEffect(() => {
    if (['denied', 'no-device', 'busy', 'insecure', 'unknown'].includes(camera.status)) {
      setProblem(cameraProblem(camera.status, navigator.userAgent));
      setStage('problem');
    }
  }, [camera.status]);

  // The camera returned after the person fixed settings (see useCameraStream): carry on automatically.
  useEffect(() => {
    if (camera.status === 'live' && stage === 'problem') begin();
  }, [camera.status, stage, begin]);

  // WHAT: skip the intro when camera access was already granted before.
  // WHY: asking someone to press "Start" when we already have permission is just friction.
  useEffect(() => {
    // WHY skip when completed: coming back to a finished check must not reopen the camera.
    if (completed || !autoStartIfAllowed || !navigator.permissions?.query) return;
    navigator.permissions.query({ name: 'camera' }).then((result) => { if (result.state === 'granted') begin(); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { loopRef.current.active = false; }, []);

  function runLoop(landmarker, steps) {
    const video = videoRef.current;
    const state = { active: true, stable: 0, yawSamples: [], neutralYaw: 0, challenge: null, lostSince: null, last: 0 };
    loopRef.current = state;
    const probe = probeRef.current;
    const probeContext = probe.getContext('2d', { willReadFrequently: true });

    function frame(timestamp) {
      if (!state.active) return;
      if (timestamp - state.last >= 90 && video.readyState >= 2 && video.videoWidth) {
        state.last = timestamp;
        try {
          // Lighting: draw a tiny copy of the frame and average its brightness.
          probeContext.drawImage(video, 0, 0, probe.width, probe.height);
          const brightness = averageBrightness(probeContext.getImageData(0, 0, probe.width, probe.height).data);
          const result = landmarker.detectForVideo(video, timestamp);
          const faces = result.faceLandmarks || [];
          const landmarks = faces[0];
          const categories = result.faceBlendshapes?.[0]?.categories || [];
          const yaw = landmarks ? faceYaw(landmarks) : null;
          const rect = boxRef.current.getBoundingClientRect();
          const geometry = { video: { width: video.videoWidth, height: video.videoHeight }, box: { width: rect.width, height: rect.height } };
          const now = Date.now();

          if (!state.challenge) {
            // ---- Positioning: wait until the conditions hold steadily, then start by ourselves.
            const verdict = assessPositioning({ landmarks, faceCount: faces.length, brightness, yaw, neutralYaw: state.yawSamples.length ? state.neutralYaw : yaw ?? 0, ...geometry });
            if (verdict.ok) {
              state.stable += 1;
              if (Number.isFinite(yaw)) { state.yawSamples.push(yaw); if (state.yawSamples.length > 12) state.yawSamples.shift(); state.neutralYaw = state.yawSamples.reduce((a, b) => a + b, 0) / state.yawSamples.length; }
            } else { state.stable = 0; state.yawSamples = []; }
            setHint(verdict.ok ? 'Great. Hold still…' : verdict.hint);
            setRing(verdict.ok ? 'go' : 'warn');
            if (state.stable >= THRESHOLDS.stableFramesToStart) {
              state.challenge = createChallengeState(steps, now);
              setChallenge(state.challenge);
              setStage('challenge');
            }
          } else {
            // ---- Challenge: the face must stay visible; prompts advance as actions are detected.
            if (!landmarks) {
              state.lostSince ??= now;
              if (now - state.lostSince > THRESHOLDS.faceLostGraceMs) {
                // Face gone too long: go back to positioning so nobody can swap in mid-check.
                state.challenge = null; state.stable = 0; state.yawSamples = [];
                setChallenge(null); setStage('positioning'); setRing('warn'); setHint('We lost your face. Place it in the oval');
              }
            } else {
              state.lostSince = null;
              let next = advanceChallenge(state.challenge, { blink: blinkAmount(categories), mouth: mouthAmount(categories), yaw, neutralYaw: state.neutralYaw, now });
              if (stepTimedOut(next, now)) next = restartStep(next, now);
              if (next !== state.challenge && (next.index !== state.challenge.index || next.done || next.stepStartedAt !== state.challenge.stepStartedAt)) setChallenge(next);
              state.challenge = next;
              if (next.done) {
                state.active = false;
                camera.stop(); // no photo is kept: the stream is simply switched off
                setStage('done');
                onVerified({ token: session.current.token, proof: buildProof(next) });
                return;
              }
            }
          }
        } catch {
          state.active = false;
          camera.stop();
          setProblem(cameraProblem('unknown', navigator.userAgent));
          setStage('problem');
          return;
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function retry() { stopAll(); begin(); }

  const step = challenge && !challenge.done ? challenge.steps[challenge.index] : null;
  const showVideo = stage === 'positioning' || stage === 'challenge';

  // WHY the video is always in the DOM (only visually dimmed when not in use): a display:none
  // video can refuse to play (see useCameraStream), so we never hide it, we just clip it away.
  return (
    <div className="mx-auto w-full max-w-xs">
      <canvas ref={probeRef} width="64" height="48" className="hidden" aria-hidden="true" />
      <div
        ref={boxRef}
        className={`relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-ink ${showVideo ? '' : 'h-0 !aspect-auto opacity-0'}`}
      >
        <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview for the face check" className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        {showVideo && (
          // WHY one SVG: a dark mask with a perfect ellipse cut out, plus the ring, share the same
          // coordinates as OVAL in livenessEngine.js, so what the person sees is what we measure.
          <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <path fillRule="evenodd" fill="rgba(0,0,0,0.55)" d={`M0 0H300V400H0Z M${300 * (OVAL.cx - OVAL.rx)} ${400 * OVAL.cy}a${300 * OVAL.rx} ${400 * OVAL.ry} 0 1 0 ${600 * OVAL.rx} 0a${300 * OVAL.rx} ${400 * OVAL.ry} 0 1 0 ${-600 * OVAL.rx} 0Z`} />
            <ellipse cx={300 * OVAL.cx} cy={400 * OVAL.cy} rx={300 * OVAL.rx} ry={400 * OVAL.ry} fill="none" stroke={RING[ring]} strokeWidth="4" style={{ transition: 'stroke 200ms' }} />
          </svg>
        )}
        {showVideo && (
          <div className="absolute inset-x-0 top-3 px-3 text-center">
            <p role="status" aria-live="polite" className="inline-block rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white">
              {stage === 'challenge' && step ? STEP_COPY[step].prompt : hint || 'Starting camera…'}
            </p>
          </div>
        )}
        {stage === 'challenge' && challenge && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" aria-label={`Step ${Math.min(challenge.index + 1, challenge.steps.length)} of ${challenge.steps.length}`}>
            {challenge.steps.map((name, index) => <span key={`${name}-${index}`} className={`h-2 w-8 rounded-full ${index < challenge.index ? 'bg-[#34c38f]' : index === challenge.index ? 'bg-white' : 'bg-white/35'}`} />)}
          </div>
        )}
      </div>

      {stage === 'intro' && (
        <div className="text-center">
          <p className="text-sm text-ink/70">We’ll check that you’re really here. Fit your face in the oval and follow a few prompts. It starts by itself and takes a few seconds. No photo is taken.</p>
          <button type="button" onClick={begin} className="mt-4 min-h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Start face check</button>
        </div>
      )}

      {stage === 'problem' && problem && (
        <div role="alert" className="rounded-2xl border border-dispute/30 bg-dispute-soft p-4 text-sm">
          <p className="font-semibold text-dispute">{problem.title}</p>
          <p className="mt-1 text-ink/75">{problem.body}</p>
          {problem.canRetry && <button type="button" onClick={retry} className="mt-3 min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">Try again</button>}
        </div>
      )}

      {stage === 'done' && (
        <div className="flex items-center gap-2 rounded-2xl bg-released-soft px-4 py-3 text-sm font-medium text-released">
          <CheckCircleIcon aria-hidden="true" width={20} height={20} />
          <span className="flex-1">Face check complete</span>
          <button type="button" onClick={() => { setChallenge(null); setStage('intro'); }} className="min-h-11 rounded-lg px-3 font-semibold underline underline-offset-2">Redo</button>
        </div>
      )}

      {onCancel && stage !== 'done' && <button type="button" onClick={() => { stopAll(); onCancel(); }} className="mt-3 block w-full text-center text-sm text-ink/60 underline underline-offset-2">Cancel</button>}
    </div>
  );
}
