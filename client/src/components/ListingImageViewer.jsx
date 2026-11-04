import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ListingImageViewer({ images, initialIndex = 0, title, onClose }) {
  const [selected, setSelected] = useState(initialIndex);

  useEffect(() => {
    setSelected(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setSelected((index) => (index + images.length - 1) % images.length);
      if (event.key === 'ArrowRight') setSelected((index) => (index + 1) % images.length);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} image viewer`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button type="button" onClick={onClose} aria-label="Close image viewer" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-paper text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
        <X aria-hidden="true" />
      </button>
      {images.length > 1 && (
        <button type="button" onClick={() => setSelected((index) => (index + images.length - 1) % images.length)} aria-label="Previous image" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:left-6">
          <ChevronLeft aria-hidden="true" />
        </button>
      )}
      <img src={images[selected]} alt={`${title} — image ${selected + 1}`} className="max-h-[88vh] max-w-[94vw] object-contain" />
      {images.length > 1 && (
        <button type="button" onClick={() => setSelected((index) => (index + 1) % images.length)} aria-label="Next image" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:right-6">
          <ChevronRight aria-hidden="true" />
        </button>
      )}
      <span aria-live="polite" className="absolute bottom-4 rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink">{selected + 1} / {images.length}</span>
    </div>
  );
}
