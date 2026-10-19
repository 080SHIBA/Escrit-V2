import { Star } from 'lucide-react';
import { formatRating } from '../../lib/marketplaceState.js';

export default function RatingStars({ ratingAvg, ratingCount, className = '' }) {
  if (!ratingCount) return <span className={`text-xs text-ink/55 ${className}`}>No reviews yet</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-ink/70 ${className}`} aria-label={`${formatRating(ratingAvg, ratingCount)} reviews`}>
      <Star size={14} aria-hidden="true" className="fill-seal text-seal" />
      <span>{formatRating(ratingAvg, ratingCount)}</span>
    </span>
  );
}
