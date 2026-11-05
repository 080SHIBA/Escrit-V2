import { useCallback, useMemo, useRef } from 'react';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { useCachedQuery } from './useCachedQuery.js';

const SAVED_KEY = 'u:saved-ids';

// WHAT: the ids of the listings the signed-in buyer has favourited.
// WHY cached: the heart icon on every card needs this. Cached, the hearts are
// correct the instant a page opens instead of popping in after a request.
// WHY gated on 'authed': anonymous visitors have no favourites, and asking the
// server anyway triggered a pointless 401 + token refresh on every page.
export function useSaved() {
  const { status } = useAuthContext();
  const { data, setData } = useCachedQuery(
    SAVED_KEY,
    async () => {
      const { items = [] } = await api.getMarketplaceSaved();
      return items
        .map((item) => item.listing?._id || item.listing?.id || item.id)
        .filter(Boolean)
        .map(String);
    },
    { enabled: status === 'authed', staleTime: 30_000 },
  );

  const savedIds = useMemo(() => new Set(data || []), [data]);

  // WHAT: ids with a save/unsave request currently in flight.
  // WHY: a fast double-tap used to fire two requests that raced each other, and the
  // second one read stale state, so the heart could end up the wrong way round.
  // Ignoring taps on a listing until its previous request finishes keeps it consistent.
  const pending = useRef(new Set());

  const toggleSaved = useCallback(async (listing) => {
    const listingId = String(listing.id);
    if (pending.current.has(listingId)) return savedIds.has(listingId);
    pending.current.add(listingId);
    const wasSaved = savedIds.has(listingId);
    // WHAT: optimistic update, undone if the server refuses.
    // WHY: the heart flips instantly instead of waiting on a slow server.
    setData((current = []) => (wasSaved ? current.filter((id) => id !== listingId) : [...current, listingId]));
    try {
      if (wasSaved) await api.removeSavedListing(listing.type, listing.id);
      else await api.saveListing(listing.type, listing.id);
      return !wasSaved;
    } catch (error) {
      setData((current = []) => (wasSaved ? [...current, listingId] : current.filter((id) => id !== listingId)));
      throw error;
    } finally {
      pending.current.delete(listingId);
    }
  }, [savedIds, setData]);

  return { savedIds, toggleSaved };
}
