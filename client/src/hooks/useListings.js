import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export function useListings({ pageSize = 6, type } = {}) {
  const [listings, setListings] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getListings({ limit: pageSize, type });
      setListings(result.items || []);
      setCursor(result.nextCursor || null);
    } catch {
      setError('We couldn’t load listings just now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pageSize, type]);

  useEffect(() => {
    let active = true;
    api.getListings({ limit: pageSize, type })
      .then((result) => {
        if (active) {
          setListings(result.items || []);
          setCursor(result.nextCursor || null);
        }
      })
      .catch(() => {
        if (active) setError('We couldn’t load listings just now. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [pageSize, type]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const result = await api.getListings({ cursor, limit: pageSize, type });
      setListings((current) => [...current, ...(result.items || [])]);
      setCursor(result.nextCursor || null);
    } catch {
      setError('We couldn’t load more listings just now. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, pageSize, type]);

  const updateListing = useCallback((id, updates) => {
    setListings((current) => current.map((listing) => listing.id === id ? { ...listing, ...updates } : listing));
  }, []);

  return { listings, loading, loadingMore, error, hasMore: Boolean(cursor), retry: loadFirstPage, loadMore, updateListing };
}
