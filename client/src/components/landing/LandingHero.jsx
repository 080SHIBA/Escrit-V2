import { useId } from 'react';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react';
import { MARKETPLACE_CATEGORIES } from '../../lib/marketplaceState.js';

export default function LandingHero({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  onSearch,
}) {
  const queryId = useId();
  const categoryId = useId();

  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-inner">
        <p className="landing-hero-pill"><ShieldCheck size={15} aria-hidden="true" /> The marketplace and escrow service</p>
        <h1 id="landing-title">
          <span>Discover more.</span>
          <span className="landing-hero-accent">Transact with confidence.</span>
        </h1>
        <p className="landing-hero-copy">
          Shop products, learn new skills, and find services—or bring Escrit escrow to a transaction you arranged anywhere.
        </p>

        <form className="landing-search" onSubmit={onSearch} role="search">
          <label className="landing-search-input" htmlFor={queryId}>
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search products, courses, and services</span>
            <input
              id={queryId}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search products, courses, and services…"
              autoComplete="off"
            />
          </label>
          <label className="sr-only" htmlFor={categoryId}>Choose a category</label>
          <select id={categoryId} value={category} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="all">All categories</option>
            {MARKETPLACE_CATEGORIES.filter((item) => item !== 'Other').map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button type="submit" className="landing-button landing-button-primary">
            Search <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>

        <div className="landing-hero-actions">
          <a className="landing-button landing-button-primary" href="#listings">
            Explore marketplace <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a className="landing-button landing-button-secondary" href="#escrow">
            Create an escrow payment link
          </a>
        </div>
        <p className="landing-account-note">
          One Escrit account for buying, selling, and managing escrow transactions.
        </p>
      </div>
    </section>
  );
}
