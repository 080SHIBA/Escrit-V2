import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { getRatingDistribution, normalizeListingDetail } from '../lib/listingDetailState.js';

export function useListingDetail(id) {
  const [listing, setListing] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [ratingDistribution, setRatingDistribution] = useState([]);
  const [related, setRelated] = useState([]);
  const [sellerListings, setSellerListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setListing(null);
    setReviews([]);
    setRatingDistribution([]);
    setRelated([]);
    setSellerListings([]);
    setLoading(true);
    setError('');

    if (!id) {
      setError('not-found');
      setLoading(false);
      return () => { active = false; };
    }

    api.getListingDetail(id)
      .then((response) => {
        const item = response?.listing || response?.item || response;
        if (!item || (item.active === false || item.isActive === false)) {
          if (active) setError('unavailable');
          return null;
        }
        if (active) setListing(normalizeListingDetail(item));
        return Promise.all([
          api.getListingDetailReviews(id),
          api.getRelatedListings(id),
        ]);
      })
      .then(async (results) => {
        if (!active || !results) return;
        const [reviewResponse, relatedResponse] = await Promise.allSettled(results);
        if (!active) return;
        if (reviewResponse.status === 'fulfilled') {
          const reviewResult = reviewResponse.value;
          setReviews(reviewResult?.reviews || reviewResult?.items || []);
          setRatingDistribution(reviewResult?.ratingDistribution || getRatingDistribution(reviewResult?.reviews || reviewResult?.items || []));
        }
        if (relatedResponse.status === 'fulfilled') {
          const relatedResult = relatedResponse.value;
          setRelated((relatedResult?.items || []).map(normalizeListingDetail));
          setSellerListings((relatedResult?.sellerListings || []).map(normalizeListingDetail));
        }
        if (reviewResponse.status === 'rejected' || relatedResponse.status === 'rejected') setError('supplemental-error');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message === 'LISTING_NOT_FOUND' || err.status === 404 || /not found|404/i.test(err.message)
          ? 'not-found'
          : err.status === 410 || /no longer available|deactivated/i.test(err.message)
            ? 'unavailable'
            : (err.message || 'load-error'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [id]);

  return { listing, reviews, ratingDistribution, related, sellerListings, loading, error };
}
