import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyCameraError } from '../lib/cameraErrors.js';

// WHAT: opens the front camera into a <video> element and reports a clear status.
//
// status: 'idle' | 'starting' | 'live' | 'denied' | 'no-device' | 'busy' | 'insecure' | 'unknown'
//
// WHY this replaces the inline camera code. Three causes of "I allowed the camera but it
// never opened" were fixed here:
//  1. The video element used to be hidden (display: none) until the face model had loaded.
//     Browsers, iOS Safari especially, may refuse to play or size a hidden video, so the
//     stream was granted but nothing started. The caller now keeps the video in the page.
//  2. Failures AFTER permission was granted (loading the model, playing the video) were all
//     reported as "allow camera access". Only a genuine permission block is reported as such.
//  3. After a block, the person fixed site settings but had to find and press the button
//     again (or reload). We watch the browser's permission state and restart on our own
//     the moment it changes to "granted".
export function useCameraStream(videoRef, { facing = 'user' } = {}) {
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState('idle');

  const stop = useCallback(() => {
    // WHY stop every track: only stopping tracks turns the camera light off and frees the
    // camera for other apps. Dropping the stream reference alone does not.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus((current) => (current === 'live' || current === 'starting' ? 'idle' : current));
  }, [videoRef]);

  const start = useCallback(async () => {
    if (!mountedRef.current) return false;
    setStatus('starting');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        const insecure = new Error('insecure');
        insecure.code = 'insecure';
        throw insecure;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          // WHY 'user' for faces, 'environment' for documents: the back camera is sharper and is the one people aim at paper.
          video: { facingMode: facing, width: { ideal: facing === 'user' ? 960 : 1920 }, height: { ideal: facing === 'user' ? 720 : 1080 } },
        });
      } catch (first) {
        // WHY a plain retry: some devices reject specific size/facing hints even though a camera
        // exists. Asking for "any video" works on those and costs nothing otherwise.
        if (classifyCameraError(first) !== 'constraints' && classifyCameraError(first) !== 'unknown') throw first;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return false; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('video element missing');
      video.srcObject = stream;
      // WHY these attributes in code too: iOS only autoplays inline, muted video.
      video.muted = true;
      video.playsInline = true;
      // WHY a timeout: play() can hang forever on a camera that never delivers frames.
      await Promise.race([
        video.play(),
        new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'AbortError' })), 8000)),
      ]);
      setStatus('live');
      return true;
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const category = classifyCameraError(error);
      setStatus(category === 'constraints' ? 'unknown' : category);
      return false;
    }
  }, [videoRef, facing]);

  // Auto-restart when the person fixes the permission in browser settings.
  useEffect(() => {
    if (status !== 'denied' || !navigator.permissions?.query) return undefined;
    let permission;
    let cancelled = false;
    const onChange = () => { if (permission?.state === 'granted' && !cancelled) start(); };
    navigator.permissions.query({ name: 'camera' }).then((result) => {
      if (cancelled) return;
      permission = result;
      result.addEventListener('change', onChange);
    }).catch(() => { /* Permissions API for camera is not supported everywhere (older Safari); the Try again button still works. */ });
    return () => { cancelled = true; permission?.removeEventListener?.('change', onChange); };
  }, [status, start]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  return { status, start, stop };
}
