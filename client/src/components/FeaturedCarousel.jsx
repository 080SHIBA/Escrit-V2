import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon, LockIcon } from './icons.jsx';

const COVER_IMAGES = {
  product: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=85',
  course: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=85',
  service: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=85',
};

const CATEGORY_COPY = {
  product: ['Discover independent finds', 'Shop useful products from independent sellers and move from inspiration to action.'],
  course: ['Make room to learn', 'Explore practical courses and learn from independent creators.'],
  service: ['Find skilled people nearby', 'Compare service providers, check availability, and book directly when you are ready.'],
};

export default function FeaturedCarousel({ items = [], type, title, empty = false, compact = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasListings = items.length > 0;
  const slideCount = hasListings ? items.length : 1;
  const activeItem = hasListings ? items[activeIndex % items.length] : null;
  const [emptyTitle, emptyBody] = CATEGORY_COPY[type] || CATEGORY_COPY.product;
  const paymentCopy = activeItem?.paymentOptions?.escrow && activeItem?.paymentOptions?.direct
    ? 'escrow optional'
    : activeItem?.paymentOptions?.escrow
      ? 'escrow only'
      : activeItem?.paymentOptions?.direct
        ? 'pay without escrow'
        : 'review payment options';

  useEffect(() => {
    if (slideCount < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setTimeout(() => setActiveIndex((index) => (index + 1) % slideCount), 8500);
    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, slideCount]);

  function move(step) {
    setActiveIndex((index) => (index + step + slideCount) % slideCount);
  }

  const destination = hasListings
    ? `/marketplace/${type}/${activeItem._id}`
    : `/marketplace/${type === 'product' ? 'products' : `${type}s`}`;
  const image = activeItem?.images?.[0] || COVER_IMAGES[type] || COVER_IMAGES.product;
  const price = !hasListings
    ? null
    : activeItem?.buyerPriceKobo != null
    ? `₦${(activeItem.buyerPriceKobo / 100).toLocaleString()}`
    : type === 'service' && !activeItem?.basePrice ? 'Get a quote' : null;

  return (
    <section
      className="featured-rail"
      aria-roledescription="carousel"
      aria-label={title || `${type} discovery`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{hasListings ? 'Selected for you' : 'Explore Escrit'}</p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl">{title || (hasListings ? 'Featured this week' : emptyTitle)}</h2>
        </div>
        <div className="flex items-center gap-3">
          {hasListings && <span className="font-mono text-xs text-ink/50">{activeIndex + 1} / {items.length}</span>}
          <Link to={`/marketplace/${type === 'product' ? 'products' : `${type}s`}`} className="text-sm font-medium text-forest-700 underline underline-offset-4 dark:text-seal">View all</Link>
        </div>
      </div>

      <div className={`group/carousel featured-card relative isolate overflow-hidden rounded-xl border border-line bg-forest-900 text-white shadow-card-lg ${compact ? 'min-h-[18rem] sm:min-h-[20rem] lg:min-h-[21rem]' : 'min-h-[19rem] sm:min-h-[24rem] lg:min-h-[27rem]'}`}>
        <Link key={activeItem?._id || `category-${type}`} to={destination} className="absolute inset-0 block animate-fade-in" aria-label={hasListings ? `View ${activeItem.title}` : `Explore ${type}`}>
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/carousel:scale-[1.025]" />
          <span className="absolute inset-0 bg-gradient-to-r from-forest-950/90 via-forest-950/65 to-forest-950/10" />
          <span className="absolute inset-0 bg-gradient-to-t from-forest-950/70 via-transparent to-forest-950/10" />
          <div className={`relative flex max-w-3xl flex-col justify-end p-5 sm:p-9 lg:p-12 ${compact ? 'min-h-[18rem] sm:min-h-[20rem] lg:min-h-[21rem]' : 'min-h-[19rem] sm:min-h-[24rem] lg:min-h-[27rem]'}`}>
            <span className="mb-auto inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-forest-950/90 px-3 py-1.5 text-xs font-medium text-white/90">
              <LockIcon width={13} height={13} /> {hasListings ? activeItem.category || type : 'Marketplace · escrow optional by listing'}
            </span>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-seal">
                {hasListings ? activeItem.seller?.businessName || 'Independent seller' : 'Browse the marketplace'}
              </p>
              <h3 className="mt-2 font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
                {hasListings ? activeItem.title : emptyTitle}
              </h3>
              <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                {hasListings ? activeItem.description || 'Explore the listing and learn more from the seller.' : emptyBody}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                {price && <span className="font-display text-2xl font-semibold sm:text-3xl">{price}</span>}
                <span className="inline-flex items-center gap-2 rounded-md bg-seal px-4 py-2.5 text-sm font-semibold text-forest-950 transition-transform group-hover/carousel:translate-x-1">
                  {hasListings ? 'View listing' : `Browse ${type}`} <ChevronRightIcon width={16} height={16} />
                </span>
                {hasListings && <span className="text-sm text-white/70">{activeItem.averageRating ? `★ ${Number(activeItem.averageRating).toFixed(1)}` : 'New listing'} · {paymentCopy}</span>}
              </div>
            </div>
          </div>
        </Link>

        {slideCount > 1 && <>
          <button type="button" onClick={() => move(-1)} aria-label="Previous featured listing" className="carousel-arrow left-3 sm:left-5"><ChevronRightIcon className="rotate-180" width={20} height={20} /></button>
          <button type="button" onClick={() => move(1)} aria-label="Next featured listing" className="carousel-arrow right-3 sm:right-5"><ChevronRightIcon width={20} height={20} /></button>
        </>}
      </div>

      {slideCount > 1 && <div className="mt-4 flex items-center justify-center gap-2" role="group" aria-label="Choose featured listing">
        {items.map((item, index) => <button key={item._id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show listing ${index + 1}: ${item.title}`} aria-current={activeIndex === index ? 'true' : undefined} className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === index ? 'w-9 bg-forest-700 dark:bg-seal' : 'w-2 bg-line-strong hover:bg-forest-700/50'}`} />)}
      </div>}
      {empty && <p className="sr-only">There are no approved listings in this category yet.</p>}
    </section>
  );
}