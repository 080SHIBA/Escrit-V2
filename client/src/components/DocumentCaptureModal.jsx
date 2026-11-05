import { useEffect, useRef, useState } from 'react';
import { useCameraStream } from '../hooks/useCameraStream.js';
import { cameraProblem } from '../lib/cameraErrors.js';
import { compressImage } from '../lib/imageCompress.js';
import { clearPickerMark, markPickerOpen } from '../lib/fileStash.js';

// WHAT: an in-page dialog for adding a document (ID, certificate...). Two ways in:
//   1. "Take a photo": opens the camera INSIDE this dialog and snaps the document.
//   2. "Choose a file": the normal file picker, as a fallback (and the only way to add a PDF).
//
// WHY a modal instead of a plain file input: on many phones, tapping a file input sends the
// person to the phone's gallery or file app. A phone with little free memory may close the
// browser page in the background meanwhile, so when they return the page has reloaded and the
// chosen file is gone. The in-page camera never leaves the page, so nothing can be lost, and
// every file we do receive is shrunk immediately to keep memory use low.
//
// Props: title, accept ('image' | 'image-or-pdf'), pickerKey (for the interruption marker),
//        notice (optional message above the buttons), onSelect(file), onClose()
export default function DocumentCaptureModal({ title, allowPdf = false, pickerKey, notice = '', onSelect, onClose }) {
  const [mode, setMode] = useState('choose'); // choose | camera | review
  const [captured, setCaptured] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const videoRef = useRef(null);
  const dialogRef = useRef(null);
  const camera = useCameraStream(videoRef, { facing: 'environment' });
  const problem = ['denied', 'no-device', 'busy', 'insecure', 'unknown'].includes(camera.status) ? cameraProblem(camera.status, navigator.userAgent) : null;

  // Basic dialog behaviour: Escape closes, focus moves inside, background does not scroll.
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; camera.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openCamera() {
    setMessage('');
    setMode('camera');
    // WHY wait a tick: the <video> is rendered in the camera mode; start() needs the element to exist.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await camera.start();
  }

  async function snap() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    setBusy(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    camera.stop();
    if (!blob) { setBusy(false); setMessage('The photo could not be taken. Try again.'); setMode('choose'); return; }
    const raw = new File([blob], `document-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const file = await compressImage(raw);
    setCaptured({ file, url: URL.createObjectURL(file) });
    setMode('review');
    setBusy(false);
  }

  function retake() {
    if (captured?.url) URL.revokeObjectURL(captured.url);
    setCaptured(null);
    openCamera();
  }

  async function onPicked(event) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    clearPickerMark(pickerKey);
    if (!picked) return;
    setBusy(true);
    const file = await compressImage(picked);
    setBusy(false);
    onSelect(file);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-card-lg outline-none sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 min-h-11 min-w-11 rounded-full text-xl leading-none text-ink/60">×</button>
        </div>

        {mode === 'choose' && (
          <div className="mt-3 space-y-3">
            {notice && <p role="status" className="rounded-xl bg-paper-2 p-3 text-sm text-ink/75">{notice}</p>}
            {message && <p role="alert" className="text-sm text-dispute">{message}</p>}
            <button type="button" onClick={openCamera} className="flex min-h-14 w-full items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Take a photo</button>
            <p className="-mt-1 text-center text-xs text-ink/55">Recommended on phones. You stay on this page.</p>
            <label className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-xl border border-line-strong px-5 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-focus">
              {busy ? 'Preparing…' : allowPdf ? 'Choose an image or PDF' : 'Choose an image'}
              <input
                type="file"
                accept={allowPdf ? 'image/*,application/pdf' : 'image/*'}
                className="sr-only"
                onClick={() => markPickerOpen(pickerKey)}
                onChange={onPicked}
                onCancel={() => clearPickerMark(pickerKey)}
              />
            </label>
          </div>
        )}

        {mode === 'camera' && (
          <div className="mt-3">
            {/* WHY the video stays rendered while the camera starts: see useCameraStream. */}
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-ink">
              <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" className="absolute inset-0 h-full w-full object-cover" />
              {/* Card-shaped guide (credit-card ratio 1.586:1). WHY: shows how to frame an ID so all edges are visible. */}
              <div className="pointer-events-none absolute left-[6%] right-[6%] top-1/2 aspect-[1.586] -translate-y-1/2 rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" aria-hidden="true" />
              <p className="absolute inset-x-0 top-3 text-center text-sm font-semibold text-white drop-shadow">Fit the document inside the frame</p>
            </div>
            {problem && (
              <div role="alert" className="mt-3 rounded-xl border border-dispute/30 bg-dispute-soft p-3 text-sm">
                <p className="font-semibold text-dispute">{problem.title}</p>
                <p className="mt-1 text-ink/75">{problem.body}</p>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => { camera.stop(); setMode('choose'); }} className="min-h-11 flex-1 rounded-xl border border-line px-4 text-sm font-semibold">Back</button>
              <button type="button" onClick={snap} disabled={camera.status !== 'live' || busy} className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-45">{busy ? 'Saving…' : 'Capture'}</button>
            </div>
          </div>
        )}

        {mode === 'review' && captured && (
          <div className="mt-3">
            <img src={captured.url} alt="Captured document" className="max-h-[60dvh] w-full rounded-2xl object-contain bg-ink" />
            <p className="mt-2 text-sm text-ink/65">Check that every detail is sharp and nothing is cut off.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={retake} className="min-h-11 flex-1 rounded-xl border border-line px-4 text-sm font-semibold">Retake</button>
              <button type="button" onClick={() => onSelect(captured.file)} className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">Use this photo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
