import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'product', label: 'Products' },
  { key: 'service', label: 'Services' },
  { key: 'course', label: 'Courses' },
];
const GOALS = ['Set up a podcast', 'Take product photos', 'Grow a small business'];

const RELATED_TERMS = {
  podcast: ['podcast', 'microphone', 'audio', 'recording', 'editing', 'sound'],
  photography: ['photography', 'camera', 'photo', 'portrait', 'headshot', 'lighting'],
  photos: ['photography', 'camera', 'photo', 'portrait', 'headshot', 'lighting'],
  business: ['business', 'bookkeeping', 'marketing', 'brand', 'excel', 'finance'],
  website: ['website', 'web design', 'wordpress', 'online shop', 'ecommerce'],
  home: ['home', 'cleaning', 'plumbing', 'electrical', 'furniture', 'kitchen'],
  learn: ['course', 'lesson', 'tutor', 'training', 'teaching', 'education'],
};

function expandQuery(query) {
  const terms = new Set(query.toLowerCase().split(/\s+/).filter((term) => term.length > 1));
  for (const [key, related] of Object.entries(RELATED_TERMS)) {
    if (query.toLowerCase().includes(key)) related.forEach((term) => terms.add(term));
  }
  return [...terms];
}

export default function MarketplaceSearchHub() {
  const [listings, setListings] = useState({ product: [], service: [], course: [] });
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all(['product', 'service', 'course'].map((type) => api.getMarketplace(type).catch(() => ({ items: [] }))))
      .then((responses) => {
        if (!active) return;
        setListings({ product: responses[0].items || [], service: responses[1].items || [], course: responses[2].items || [] });
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    const terms = expandQuery(query.trim());
    if (!terms.length) return [];
    const types = scope === 'all' ? ['product', 'service', 'course'] : [scope];
    return types.flatMap((type) => listings[type]
      .map((listing) => {
        const text = `${listing.title} ${listing.description} ${listing.category} ${listing.seller?.businessName}`.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (text.includes(term) ? (listing.title.toLowerCase().includes(term) ? 3 : 1) : 0), 0);
        return { ...listing, type, score };
      })
      .filter((listing) => listing.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, scope === 'all' ? 3 : 6))
      .sort((left, right) => right.score - left.score)
      .slice(0, scope === 'all' ? 9 : 6);
  }, [listings, query, scope]);

  return (
    <section className="search-hub border-y border-line bg-surface" aria-labelledby="search-hub-title">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">ONE SEARCH, EVERY CATEGORY</p>
            <h2 id="search-hub-title" className="mt-1 font-display text-2xl sm:text-3xl">What are you looking for?</h2>
          </div>
          <p className="max-w-sm text-sm leading-5 text-ink/55">Search products, services, and courses together. Choose a category to narrow your results.</p>
        </div>

        <label className="mt-5 block">
          <span className="sr-only">Search products, services, and courses</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try podcast gear, family photography, or Excel basics" className="w-full rounded-lg border border-line-strong bg-input px-4 py-3 text-sm focus:border-accent sm:text-base" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Search category">
          {TYPES.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={scope === key} onClick={() => setScope(key)} className={`min-h-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${scope === key ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink/70 hover:border-accent/50 hover:text-ink'}`}>{label}</button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-ink/50">Popular goals</span>{GOALS.map((goal) => <button key={goal} type="button" onClick={() => { setScope('all'); setQuery(goal); }} className="rounded-full bg-forest-50 px-3 py-1.5 text-forest-800 transition-colors hover:bg-forest-100 dark:bg-forest-50 dark:text-ink dark:hover:bg-forest-100">{goal}</button>)}</div>

        {query.trim() && <div className="mt-6" aria-live="polite">
          {loading ? <p className="text-sm text-ink/55">Searching the marketplace…</p> : results.length ? <>
            {scope === 'all' && <div className="mb-4 border-l-2 border-ochre pl-3"><p className="text-sm font-semibold">A starter set for “{query}”</p><p className="mt-1 text-xs text-ink/55">Related finds across categories. Each listing has its own checkout and seller terms.</p></div>}
            <div className={`grid gap-3 ${scope === 'all' ? 'lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {(scope === 'all' ? ['product', 'service', 'course'] : [scope]).map((type) => {
              const entries = results.filter((listing) => listing.type === type).slice(0, scope === 'all' ? 3 : 6);
              return <section key={type} className="min-w-0"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-forest-700 dark:text-seal">{type === 'product' ? 'Products' : type === 'service' ? 'Services' : 'Courses'}</h3>{entries.length ? <div className="space-y-2">{entries.map((listing) => <ListingResult key={`${listing.type}:${listing._id}`} listing={listing} />)}</div> : <p className="border-t border-line py-3 text-xs text-ink/45">No direct matches yet.</p>}</section>;
            })}
            </div>
          </> : <p className="border-t border-line pt-4 text-sm text-ink/55">No matches yet. Try a broader term or another category.</p>}
        </div>}
      </div>
    </section>
  );
}

function ListingResult({ listing }) {
  const price = listing.type === 'service' && !listing.basePrice
    ? 'Get a quote'
    : listing.buyerPriceKobo != null ? `₦${(listing.buyerPriceKobo / 100).toLocaleString()}` : 'Price unavailable';
  return <Link to={`/marketplace/${listing.type}/${listing._id}`} className="flex min-w-0 items-center gap-3 rounded-md border border-line bg-paper p-3 transition-colors hover:border-forest-700/50">
    <img src={listing.images?.[0] || '/logo-icon.png'} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{listing.title}</span><span className="mt-1 block text-xs text-ink/55">{price}</span></span>
  </Link>;
}
