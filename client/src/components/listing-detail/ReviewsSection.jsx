import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { getRatingDistribution } from '../../lib/listingDetailState.js';

export default function ReviewsSection({ listing, reviews, ratingDistribution }) {
  const { seller, status } = useAuthContext();
  const [reviewList, setReviewList] = useState(reviews);
  const [eligibility, setEligibility] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibilityError, setEligibilityError] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [average, setAverage] = useState(Number(listing.ratingAvg || 0));
  const [count, setCount] = useState(Number(listing.ratingCount || 0));
  const [localDistribution, setLocalDistribution] = useState(ratingDistribution);
  const reviewerId = String(seller?._id || seller?.id || '');
  const isOwn = Boolean(reviewerId && reviewerId === String(listing.sellerId));

  useEffect(() => setReviewList(reviews), [reviews]);
  useEffect(() => {
    let active = true;
    setEligibility(null);
    setEligibilityError('');
    setCheckingEligibility(false);
    if (status !== 'authed' || isOwn) return () => { active = false; };
    setCheckingEligibility(true);
    api.getReviewEligibility(listing.type, listing.id, reviewerId)
      .then((result) => { if (active) setEligibility(result); })
      .catch((err) => { if (active) setEligibilityError(err.message || 'We couldn’t check review eligibility.'); })
      .finally(() => { if (active) setCheckingEligibility(false); });
    return () => { active = false; };
  }, [isOwn, listing.id, listing.type, reviewerId, status]);

  const completedReviews = reviewList.filter((review) => review.completedOrder !== false);
  const distribution = localDistribution?.length ? localDistribution : getRatingDistribution(completedReviews);

  useEffect(() => {
    setAverage(Number(listing.ratingAvg || 0));
    setCount(Number(listing.ratingCount || 0));
    setLocalDistribution(ratingDistribution);
  }, [listing.id, listing.ratingAvg, listing.ratingCount, ratingDistribution]);
  async function submitReview(event) {
    event.preventDefault();
    if (!eligibility?.transactionId) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.createListingReview(listing.type, listing.id, {
        transactionId: eligibility.transactionId,
        rating: Number(rating),
        comment: comment.trim(),
      }, reviewerId);
      setAverage(Number(result.ratingAvg || average));
      setCount(Number(result.ratingCount || count + 1));
      setEligibility({ eligible: false });
      setComment('');
      try {
        const fresh = await api.getListingDetailReviews(listing.id);
        const updatedReviews = fresh.reviews || [];
        setReviewList(updatedReviews);
        setLocalDistribution(fresh.ratingDistribution || getRatingDistribution(updatedReviews));
      } catch (refreshError) {
        setError(`Your review was submitted, but the review list could not be refreshed: ${refreshError.message}`);
      }
    } catch (submitError) {
      setError(submitError.message || 'We couldn’t submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="reviews" className="scroll-mt-28 border-t border-line pt-7" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="font-display text-xl">Reviews</h2>
      <div className="mt-4 grid gap-6 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[11rem_1fr] sm:p-5">
        <div>
          <p className="flex items-center gap-2 text-3xl font-semibold">
            <Star aria-hidden="true" className="fill-seal text-seal" size={24} />
            {average.toFixed(1)}
          </p>
          <p className="mt-1 text-sm text-ink/60">{count} {count === 1 ? 'review' : 'reviews'}</p>
        </div>
        <div className="space-y-2" aria-label="Rating distribution">
          {distribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-xs">
              <span>{rating} star</span>
              <span className="h-2 overflow-hidden rounded-full bg-paper-3">
                <span className="block h-full rounded-full bg-seal" style={{ width: `${percentage}%` }} />
              </span>
              <span className="text-right text-ink/55">{count}</span>
            </div>
          ))}
        </div>
      </div>
      {status !== 'authed' && <p className="mt-4 text-sm text-ink/60"><Link to={`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`} className="min-h-11 inline-flex items-center underline underline-offset-4">Sign in</Link> to review after a completed order.</p>}
      {status === 'authed' && !isOwn && checkingEligibility && <p className="mt-4 text-sm text-ink/55">Checking completed-order review eligibility…</p>}
      {status === 'authed' && !isOwn && eligibility && !eligibility.eligible && <p className="mt-4 text-sm text-ink/55">Reviews are available only to buyers with a completed order.</p>}
      {isOwn && <p className="mt-4 text-sm text-ink/55">You can’t review your own listing.</p>}
      {eligibilityError && <p role="alert" className="mt-4 text-sm text-dispute">{eligibilityError}</p>}
      {status === 'authed' && !isOwn && eligibility?.eligible && (
        <form onSubmit={submitReview} className="mt-4 space-y-3 rounded-xl border border-line p-4">
          <h3 className="font-semibold">Review your completed order</h3>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label className="text-sm font-medium">Rating
              <select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3">
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} of 5</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Your experience
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-line bg-input p-3" placeholder="Share helpful details for other buyers" />
            </label>
          </div>
          {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
          <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{submitting ? 'Submitting…' : 'Submit review'}</button>
        </form>
      )}
      {error && !eligibility?.eligible && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}
      {!completedReviews.length ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink/60">No reviews yet. Reviews are available to buyers with a completed order.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {completedReviews.map((review) => (
            <li key={review.id || `${review.createdAt}-${review.buyerName}`} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{review.buyerName || 'Verified buyer'}</p>
                <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs text-ink/65">Completed order</span>
              </div>
              <p className="mt-2 text-sm" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}</p>
              {review.comment && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink/70">{review.comment}</p>}
              {review.createdAt && <time className="mt-2 block text-xs text-ink/50" dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-5 text-ink/55">Only buyers with a completed order can review this listing.</p>
    </section>
  );
}
