import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { fetchQuery, getEntry, isFresh, setData, subscribe } from '../lib/queryCache.js';

// WHAT: React binding for queryCache. Gives a component the cached data for a
// key immediately, then refreshes it in the background when it is stale.
//
// WHY a hook: every page needs the same "show what we know, refresh quietly,
// show an error only if there is nothing to show" behaviour. Writing it once
// keeps the pages simple and the behaviour identical everywhere.
//
// Returns:
//   data        cached or fresh data, or undefined if never loaded
//   loading     true ONLY when there is nothing to show yet (skeleton time)
//   refreshing  true while a background refresh runs (show nothing or a subtle cue)
//   error       the last failure, but only surfaced if there is no data to show
//   refetch     force a new request (the "Retry" button)
//   setData     optimistic update of the cached value
export function useCachedQuery(key, fetcher, {
  enabled = true,
  staleTime = 30_000,
  retryDelays,
  merge,
} = {}) {
  // WHY a reducer tick: the data lives in the shared cache, not in React state.
  // The tick just tells React "re-read the cache".
  const [, rerender] = useReducer((count) => count + 1, 0);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  // WHY refs: the fetcher is usually an inline arrow that changes every render.
  // Reading it through a ref stops that from re-triggering the effect.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mergeRef = useRef(merge);
  mergeRef.current = merge;

  useEffect(() => subscribe(key, rerender), [key]);

  const run = useCallback(async (force) => {
    if (!key) return undefined;
    setFetching(true);
    try {
      const entry = getEntry(key);
      // staleTime may be a function so a caller can say "this cached value is
      // incomplete, treat it as stale" (see useListingDetail).
      const effectiveStale = typeof staleTime === 'function' ? staleTime(entry?.data) : staleTime;
      const result = await fetchQuery(key, () => fetcherRef.current(), {
        staleTime: effectiveStale,
        force,
        retryDelays,
        merge: mergeRef.current,
      });
      setError(null);
      return result;
    } catch (cause) {
      setError(cause);
      return undefined;
    } finally {
      setFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, staleTime, retryDelays]);

  useEffect(() => {
    setError(null);
    if (!enabled || !key) return;
    run(false);
  }, [key, enabled, run]);

  const entry = key ? getEntry(key) : null;
  const hasData = entry !== null && entry !== undefined;
  const stale = hasData && !isFresh(key, typeof staleTime === 'function' ? staleTime(entry.data) : staleTime);

  return {
    data: hasData ? entry.data : undefined,
    // WHY: with cached data there is never a skeleton, only a quiet refresh.
    loading: !hasData && (enabled ? fetching || !error : false),
    refreshing: hasData && (fetching || stale),
    // WHY hide errors when data exists: a failed background refresh should not
    // replace a perfectly good screen with an error message.
    error: hasData ? null : error,
    refetch: useCallback(() => run(true), [run]),
    setData: useCallback((next) => setData(key, next), [key]),
  };
}
