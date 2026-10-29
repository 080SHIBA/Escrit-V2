import { useRef, useState } from 'react';
import ItemPhoto from './ItemPhoto.jsx';
import { ImageIcon } from './icons.jsx';
import { uploadItemPhoto, uploadItemVideo, MAX_PHOTO_MB, MAX_VIDEO_MB } from '../lib/cloudinary.js';

const HTTPS_URL = /^https:\/\/\S+\.\S+$/i;

// Photo input for a payment link. Sellers either upload from their
// device (stored on Cloudinary) or paste an image link. `value` is the
// final HTTPS URL, or an empty string.
export default function PhotoField({ value, onChange, mediaType = 'image', required = false }) {
  const fileInput = useRef(null);
  const [progress, setProgress] = useState(null); // null when idle, else 0-100
  const [uploadError, setUploadError] = useState(null);
  const [showLink, setShowLink] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const uploading = progress !== null;
  const isVideo = mediaType === 'video';
  const maxSizeMb = isVideo ? MAX_VIDEO_MB : MAX_PHOTO_MB;
  const hasPreviewableUrl = HTTPS_URL.test(value);

  async function uploadFile(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith(isVideo ? 'video/' : 'image/')) {
      throw new Error(`Please choose a ${isVideo ? 'video' : 'image'} file.`);
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new Error(`That ${isVideo ? 'video' : 'photo'} is over ${maxSizeMb} MB. Choose a smaller one.`);
    }

    setUploadError(null);
    setLoadFailed(false);
    setProgress(0);
    try {
      onChange(await (isVideo ? uploadItemVideo(file, setProgress) : uploadItemPhoto(file, setProgress)));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setProgress(null);
    }
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again
    if (!file) return;
    await uploadFile(file);
  }

  function onLinkChange(e) {
    setLoadFailed(false);
    onChange(e.target.value.trim()); // pasted links often carry stray whitespace
  }

  function onDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      uploadFile(file);
    }
  }

  function onPasteUrl(e) {
    const pasted = e.clipboardData?.getData('text');
    if (!pasted) return;
    const trimmed = pasted.trim();
    if (!trimmed) return;
    if (HTTPS_URL.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
      e.preventDefault();
      setShowLink(true);
      onChange(trimmed);
    }
  }

  function remove() {
    setLoadFailed(false);
    setUploadError(null);
    onChange('');
  }

  return (
    <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
      <span className="text-sm text-ink/70">
        {isVideo ? 'Lesson video' : 'Photo'} <span className="text-ink/40">({required ? 'required' : 'optional'})</span>
      </span>

      <input ref={fileInput} type="file" accept={isVideo ? 'video/mp4,video/webm,video/quicktime' : 'image/*'} hidden onChange={onFileChosen} />

      <div
        className={`mt-2 rounded-xl border border-dashed p-4 text-sm transition-colors ${
          isDragging ? 'border-ink bg-ink/5' : 'border-line bg-line/10'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 border border-line-strong px-3.5 py-2 text-sm font-medium rounded-lg hover:border-ink transition-colors disabled:opacity-50"
          >
            <ImageIcon width={16} height={16} />
            {value ? `Replace ${isVideo ? 'video' : 'photo'}` : 'Upload from device'}
          </button>
          <button
            type="button"
            onClick={() => setShowLink((s) => !s)}
            className="text-sm text-ink/60 hover:text-ink underline underline-offset-2 px-1 py-2"
          >
            {showLink ? 'Hide image link' : 'Paste a URL'}
          </button>
          {value && !uploading && (
            <button type="button" onClick={remove} className="text-sm text-ink/50 hover:text-dispute px-1 py-2 ml-auto">
              Remove
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-ink/55">
          Drag and drop a {isVideo ? 'short video' : 'photo'} here, choose a file from your device, or paste a direct media URL.
        </p>
      </div>

      {hasPreviewableUrl && (
        <div className="mt-3 rounded-xl overflow-hidden border border-line bg-line/20">
          {!loadFailed && (
            isVideo ? (
              <video controls preload="metadata" className="w-full max-h-56 bg-black" onError={() => setLoadFailed(true)}>
                <source src={value} />
              </video>
            ) : (
              <ItemPhoto
                src={value}
                alt="Item preview"
                width={800}
                className="w-full max-h-56 object-cover animate-fade-in"
                onError={() => setLoadFailed(true)}
              />
            )
          )}
          {loadFailed && (
              <p className="p-4 text-sm text-dispute" role="alert">
                This media link did not load. Use a direct, public URL, or upload it from your device.
            </p>
          )}
        </div>
      )}

      {uploading && (
        <div className="mt-2" role="status">
          <div className="h-1.5 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-seal transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-ink/50 mt-1">Uploading… {progress}%</p>
        </div>
      )}

      {showLink && (
        <input
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={onLinkChange}
          onPaste={onPasteUrl}
          placeholder="https://…"
          aria-label="Image link"
          className="mt-2 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg"
        />
      )}

      {uploadError && (
        <p className="text-dispute text-sm mt-2" role="alert">
          {uploadError}
        </p>
      )}
      {!value && !uploading && !uploadError && (
        <p className="text-xs text-ink/45 mt-2">{isVideo ? `MP4 or WebM, up to ${MAX_VIDEO_MB} MB.` : `JPG, PNG, WebP or HEIC, up to ${MAX_PHOTO_MB} MB.`}</p>
      )}
    </div>
  );
}
