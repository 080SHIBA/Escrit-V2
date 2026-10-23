import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80';

export default function Gallery({ listing }) {
  const images = Array.from({ length: 4 }, (_, index) => listing.gallery?.[index] || listing.coverUrl || IMAGE_FALLBACK);
  const [selected, setSelected] = useState(0);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const previous = () => setSelected((index) => (index + images.length - 1) % images.length);
  const next = () => setSelected((index) => (index + 1) % images.length);
  const markFailed = (index) => setFailedImages((current) => new Set(current).add(index));

  return (
    <section aria-label={listing.type === 'service' ? 'Sample work gallery' : 'Listing gallery'} className="space-y-3">
      {listing.type === 'service' && <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Sample work</p>}
      <div className="relative overflow-hidden rounded-2xl bg-paper-2">
        {failedImages.has(selected)
          ? <div role="img" aria-label={`${listing.title} — image ${selected + 1} unavailable`} className="flex aspect-[4/3] w-full items-center justify-center bg-accent/10 font-display text-6xl text-accent">{listing.title.trim().charAt(0).toLocaleUpperCase()}</div>
          : <img key={`${listing.id}-${selected}`} src={images[selected]} alt={`${listing.title} — image ${selected + 1}`} onError={() => markFailed(selected)} className="aspect-[4/3] w-full object-cover" />}
        <button type="button" onClick={previous} aria-label="Previous image" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper/95 shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" onClick={next} aria-label="Next image" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-paper/95 shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          <ChevronRight aria-hidden="true" />
        </button>
        <span aria-live="polite" className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-paper">{selected + 1} / 4</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            aria-label={`Show image ${index + 1}`}
            aria-current={selected === index ? 'true' : undefined}
            onClick={() => setSelected(index)}
            className={`overflow-hidden rounded-lg border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${selected === index ? 'border-accent' : 'border-transparent'}`}
          >
            {failedImages.has(index)
              ? <span aria-hidden="true" className="flex aspect-square w-full items-center justify-center bg-accent/10 font-semibold text-accent">{listing.title.trim().charAt(0).toLocaleUpperCase()}</span>
              : <img src={image} alt={`${listing.title} thumbnail ${index + 1}`} loading="lazy" onError={() => markFailed(index)} className="aspect-square w-full object-cover" />}
          </button>
        ))}
      </div>
    </section>
  );
}
