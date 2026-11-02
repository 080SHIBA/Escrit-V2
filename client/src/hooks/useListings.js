import { useCallback, useState } from 'react';
import { api } from '../lib/api.js';
import { fetchQuery, setData } from '../lib/queryCache.js';
import { useCachedQuery } from './useCachedQuery.js';

// WHAT: delays between automatic retries of the first page of listings.
// WHY: when the server is waking from sleep the first request fails or hangs.
// Retrying quietly (while the skeleton or cached listings stay on screen) means
// the visitor sees listings appear on their own instead of pressing "Retry".
const FIRST_PAGE_RETRY_DELAYS_MS = [3000, 6000, 10000];

// WHAT: public listings are fresh for 60s, then refreshed in the background.
// WHY: marketplace data changes slowly; 60s avoids refetching on every quick
// back-and-forth between pages while still self-correcting soon after.
const LISTINGS_STALE_MS = 60_000;

// WHAT: when page 1 is refreshed, keep any extra pages the visitor already loaded.
// WHY: otherwise a background refresh would silently shrink a list they had
// scrolled deep into and yank the page from under them.
function mergeRefreshedFirstPage(old, fresh) {
  const freshIds = new Set(fresh.items.map((item) => item.id));
  const extra = old.items.filter((item) => !freshIds.has(item.id));
  const hadMorePages = old.items.length > fresh.items.length;
  return {
    items: hadMorePages ? [...fresh.items, ...extra] : fresh.items,
    cursor: hadMorePages ? old.cursor : fresh.cursor,
  };
}

export function useListings({ pageSize = 6, type } = {}) {
  // WHY the key includes pageSize: the home page (6) and marketplace (larger)
  // hold different amounts, and must not overwrite each other's cache entry.
  const key = `pub:listings:${type || 'all'}:${pageSize}`;
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');

  const { data, loading, error, refetch } = useCachedQuery(
    key,
    async () => {
      const result = await api.getListings({ limit: pageSize, type });
      return { items: result.items || [], cursor: result.nextCursor || null };
    },
    { staleTime: LISTINGS_STALE_MS, retryDelays: FIRST_PAGE_RETRY_DELAYS_MS, merge: mergeRefreshedFirstPage },
  );

  const listings = data?.items || [];
  const cursor = data?.cursor || null;

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError('');
    try {
      const result = await api.getListings({ cursor, limit: pageSize, type });
      // WHY write into the cache (not local state): if the visitor opens a
      // listing and comes back, every page they loaded is still there.
      setData(key, (current) => {
        const seen = new Set((current?.items || []).map((item) => item.id));
        return {
          items: [...(current?.items || []), ...(result.items || []).filter((item) => !seen.has(item.id))],
          cursor: result.nextCursor || null,
        };
      });
    } catch {
      setMoreError('We couldn’t load more listings just now. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, key, loadingMore, pageSize, type]);

  const updateListing = useCallback((id, updates) => {
    setData(key, (current) => current && ({
      ...current,
      items: current.items.map((listing) => listing.id === id ? { ...listing, ...updates } : listing),
    }));
  }, [key]);

  const errorMessage = error ? 'We couldn’t load listings just now. Please try again.' : moreError;

  return {
    listings,
    loading,
    loadingMore,
    error: errorMessage,
    hasMore: Boolean(cursor),
    retry: refetch,
    loadMore,
    updateListing,
  };
}

// WHAT: warm the cache for the first page of a marketplace tab.
// WHY: called when the visitor hovers a tab link, so the tab opens already filled.
export function prefetchListings({ pageSize, type }) {
  const key = `pub:listings:${type || 'all'}:${pageSize}`;
  return fetchQuery(key, async () => {
    const result = await api.getListings({ limit: pageSize, type });
    return { items: result.items || [], cursor: result.nextCursor || null };
  }, { staleTime: LISTINGS_STALE_MS }).catch(() => {});
}
