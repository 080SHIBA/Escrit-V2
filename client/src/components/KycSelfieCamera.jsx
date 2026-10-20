import { useEffect, useRef, useState } from 'react';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { CheckCircleIcon } from './icons.jsx';
import { createLivenessState, updateLivenessState } from '../lib/kycLiveness.js';

const WASM_FILESET = { wasmLoaderPath, wasmBinaryPath };
const MODEL_PATH = '/models/face_landmarker.task';

function cameraError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Allow camera access in your browser settings, then try again.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No camera was found. Connect a camera and try again.';
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return 'Your camera is already in use by another app. Close it and try again.';
  }
  if (error?.name === 'Error') {
    return 'The liveness check could not be loaded. Reload the page and try again.';
  }
  return 'The camera could not be started. Check your browser permissions and try again.';
}

function faceYaw(landmarks) {
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  if (!nose || !leftEye || !rightEye) return null;
  const eyeDistance = Math.abs(leftEye.x - rightEye.x);
  if (eyeDistance < 0.001) return null;
  return (nose.x - (leftEye.x + rightEye.x) / 2) / eyeDistance;
}

function blinkScore(categories = []) {
  return Math.max(
    categories.find((category) => category.categoryName === 'eyeBlinkLeft')?.score || 0,
    categories.find((category) => category.categoryName === 'eyeBlinkRight')?.score || 0
  );
}

export default function KycSelfieCamera({ file, onChange, required = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const mountedRef = useRef(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [challenge, setChallenge] = useState(createLivenessState);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!cameraOn || !landmarkerRef.current || !videoRef.current) return undefined;

    let active = true;
    let frameId;
    let lastDetection = 0;
    const video = videoRef.current;

    function detectFrame(timestamp) {
      if (!active) return;
      if (timestamp - lastDetection >= 100 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        lastDetection = timestamp;
        try {
          const result = landmarkerRef.current.detectForVideo(video, timestamp);
          const landmarks = result.faceLandmarks[0];
          const present = Boolean(landmarks);
          setFaceDetected((current) => current === present ? current : present);
          const categories = result.faceBlendshapes[0]?.categories || [];
          const state = updateLivenessState(challengeRef.current, {
            faceDetected: present,
            blinkScore: blinkScore(categories),
            yaw: landmarks ? faceYaw(landmarks) : null,
          });
          if (state !== challengeRef.current) {
            challengeRef.current = state;
            setChallenge(state);
          }
        } catch {
          setError('The camera check stopped unexpectedly. Restart the camera to continue.');
          stopCamera();
          return;
        }
      }
      frameId = window.requestAnimationFrame(detectFrame);
    }

    frameId = window.requestAnimationFrame(detectFrame);
    return () => {
      active = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [cameraOn]);

  const challengeRef = useRef(challenge);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setCameraOn(false);
    setFaceDetected(false);
  }

  async function startCamera() {
    setError('');
    setStarting(true);
    setChallenge(createLivenessState());
    challengeRef.current = createLivenessState();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is unavailable. Open this page in a secure browser context.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const landmarker = await FaceLandmarker.createFromOptions(WASM_FILESET, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputFaceBlendshapes: true,
      });
      if (!mountedRef.current) {
        landmarker.close();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      landmarkerRef.current = landmarker;
      setCameraOn(true);
    } catch (cause) {
      stopCamera();
      setError(cause?.message?.startsWith('Camera access is unavailable')
        ? cause.message
        : cameraError(cause));
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  }

  async function captureSelfie() {
    const video = videoRef.current;
    if (!video || !challengeRef.current.complete) return;
    setCapturing(true);
    setError('');
    try {
      const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not prepare the selfie image. Try a different browser.');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('The selfie image could not be captured. Try again.')), 'image/jpeg', 0.9);
      });
      if (blob.size > 5 * 1024 * 1024) throw new Error('The captured selfie is too large. Move closer to the camera and try again.');
      onChange(new File([blob], `selfie-liveness-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      stopCamera();
    } catch (cause) {
      setError(cause.message || 'The selfie could not be captured. Try again.');
    } finally {
      setCapturing(false);
    }
  }

  function retake() {
    onChange(null);
    setChallenge(createLivenessState());
    challengeRef.current = createLivenessState();
    startCamera();
  }

  return (
    <div>
      <p className="text-sm font-medium">Live selfie{required ? ' (required)' : ' (optional)'}</p>
      <p className="mt-1 text-sm text-ink/60">Camera frames are checked on this device. Only the captured selfie image is submitted for review.</p>
      <div className={`relative mt-3 aspect-[4/3] max-w-md overflow-hidden rounded-2xl border border-line bg-ink ${cameraOn && !file ? '' : 'hidden'}`}>
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" aria-label="Live selfie camera preview" />
        <div className="pointer-events-none absolute inset-[12%] rounded-[50%] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" aria-hidden="true" />
      </div>
      {file ? (
        <div className="mt-3 flex min-h-12 items-center gap-2 rounded-xl bg-released-soft px-3 py-2 text-sm text-released">
          <CheckCircleIcon aria-hidden="true" width={18} height={18} />
          <span className="min-w-0 flex-1 truncate">Liveness check complete · {file.name}</span>
          <button type="button" onClick={retake} disabled={starting} className="min-h-11 rounded-lg px-3 font-semibold underline underline-offset-2 disabled:opacity-50">Retake</button>
        </div>
      ) : (
        <>
          {cameraOn ? (
            <div className="mt-3">
              <p className="mt-3 text-sm font-medium" role="status" aria-live="polite">
                {!faceDetected
                  ? 'Center your face in the guide and look at the camera.'
                  : challenge.complete
                    ? 'Liveness check complete. You can capture your selfie.'
                    : challenge.neutralYaw === null
                      ? 'Look straight at the camera to begin.'
                      : 'Blink, or turn your head left and right.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={captureSelfie} disabled={!challenge.complete || capturing} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45">
                  {capturing ? 'Capturing…' : 'Capture selfie'}
                </button>
                <button type="button" onClick={stopCamera} className="min-h-11 rounded-xl border border-line px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Cancel camera</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={startCamera} disabled={starting} className="mt-3 min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50">
              {starting ? 'Starting camera…' : 'Start camera'}
            </button>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-dispute">{error}</p>}
      <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-ink/60">
        <li>Allow camera access and use a well-lit place.</li>
        <li>Remove hats and sunglasses; blink or turn your head left and right.</li>
        <li>The live camera stream stays on this device; the captured selfie is uploaded for identity review.</li>
      </ul>
    </div>
  );
}
