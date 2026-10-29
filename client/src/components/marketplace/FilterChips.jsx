import { Star } from 'lucide-react';
import { MARKETPLACE_CATEGORIES } from '../../lib/marketplaceState.js';

export default function FilterChips({ minRating, onRatingChange, category, onCategoryChange, categories = MARKETPLACE_CATEGORIES }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Minimum rating">
        <button
          type="button"
          aria-pressed={minRating === '4.5'}
          onClick={() => onRatingChange(minRating === '4.5' ? '' : '4.5')}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${
            minRating === '4.5' ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink/70 hover:border-accent/50'
          }`}
        >
          <Star size={15} aria-hidden="true" /> 4.5 stars and up
        </button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Listing category">
        {['all', ...categories].map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={category === name}
            onClick={() => onCategoryChange(name)}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${
              category === name ? 'border-line-strong bg-paper-2 text-ink' : 'border-line bg-surface text-ink/65 hover:border-line-strong hover:text-ink'
            }`}
          >
            {name === 'all' ? 'Any category' : name}
          </button>
        ))}
      </div>
    </div>
  );
}
