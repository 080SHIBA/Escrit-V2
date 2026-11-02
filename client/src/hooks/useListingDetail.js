import { useCachedQuery } from './useCachedQuery.js';
import { prefetch } from '../lib/queryCache.js';
import { api } from '../lib/api.js';
import { getRatingDistribution, normalizeListingDetail } from '../lib/listingDetailState.js';

// WHAT: how long a listing page's data counts as fresh.
// WHY: a listing the visitor just viewed reopens instantly; the background
// refresh still catches price or availability changes within a minute.
const DETAIL_STALE_MS = 60_000;

// WHAT: turn a failed request into the short error codes the page understands.
function toErrorCode(err) {
  if (!err) return '';
  if (err.message === 'LISTING_NOT_FOUND' || err.status === 404 || /not found|404/i.test(err.message)) return 'not-found';
  if (err.message === 'LISTING_UNAVAILABLE' || err.status === 410 || /no longer available|deactivated/i.test(err.message)) return 'unavailable';
  return err.message || 'load-error';
}

// WHAT: load and validate one listing.
// WHY a shared function: the page and the hover-prefetch must run identical logic
// so the cache never holds something the page would have rejected.
async function fetchListing(id) {
  const response = await api.getListingDetail(id);
  const item = response?.listing || response?.item || response;
  if (!item) throw Object.assign(new Error('LISTING_NOT_FOUND'), { status: 404 });
  // WHY throw: an inactive listing must not be cached as if it were fine.
  if (item.active === false || item.isActive === false) throw new Error('LISTING_UNAVAILABLE');
  return normalizeListingDetail(item);
}

// WHAT: start loading a listing before the visitor clicks it.
// WHY: hovering or touching a card usually precedes the click by a few hundred
// ms; that head start makes the listing page open already filled.
export function prefetchListingDetail(id) {
  if (id) prefetch(`pub:listing:${id}`, () => fetchListing(id));
}

export function useListingDetail(id) {
  // WHAT: the listing itself, cached per id.
  // WHY separate from reviews/related: the listing is what the visitor came for,
  // so it must show the moment it arrives; secondary data fills in afterwards.
  const detail = useCachedQuery(
    id ? `pub:listing:${id}` : null,
    () => fetchListing(id),
    { staleTime: DETAIL_STALE_MS },
  );

  const listing = detail.data || null;

  // WHAT: reviews and related listings, loaded only once the listing exists.
  // WHY allSettled: they are independent. With Promise.all one failure rejected
  // both and the whole page showed an error although the listing loaded fine.
  const extras = useCachedQuery(
    listing ? `pub:listing-extras:${id}` : null,
    async () => {
      const [reviewResponse, relatedResponse] = await Promise.allSettled([
        api.getListingDetailReviews(id),
        api.getRelatedListings(id),
      ]);
      if (reviewResponse.status === 'rejected' && relatedResponse.status === 'rejected') throw reviewResponse.reason;
      const reviewResult = reviewResponse.status === 'fulfilled' ? reviewResponse.value : null;
      const reviews = reviewResult?.reviews || reviewResult?.items || [];
      const relatedResult = relatedResponse.status === 'fulfilled' ? relatedResponse.value : null;
      return {
        reviews,
        ratingDistribution: reviewResult?.ratingDistribution || getRatingDistribution(reviews),
        related: (relatedResult?.items || []).map(normalizeListingDetail),
        sellerListings: (relatedResult?.sellerListings || []).map(normalizeListingDetail),
        // WHY a flag: a half-loaded result is shown but treated as stale, so the
        // missing half is retried next time instead of being cached as "empty".
        partial: reviewResponse.status === 'rejected' || relatedResponse.status === 'rejected',
      };
    },
    { staleTime: (data) => (data?.partial ? 0 : DETAIL_STALE_MS) },
  );

  const secondary = extras.data;
  const error = !id
    ? 'not-found'
    : detail.error
      ? toErrorCode(detail.error)
      : secondary?.partial || (listing && extras.error) ? 'supplemental-error' : '';

  return {
    listing,
    reviews: secondary?.reviews || [],
    ratingDistribution: secondary?.ratingDistribution || [],
    related: secondary?.related || [],
    sellerListings: secondary?.sellerListings || [],
    loading: Boolean(id) && detail.loading,
    error,
  };
}
