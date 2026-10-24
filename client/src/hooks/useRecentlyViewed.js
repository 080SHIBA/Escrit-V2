import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';

const STORAGE_KEY = 'escrit:recently-viewed';

function readLocalRecentlyViewed() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.slice(-10).reverse() : [];
  } catch (error) {
    console.warn('[recently-viewed] Could not read browser history:', error.message);
    return [];
  }
}

function writeLocalRecentlyViewed(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-10)));
  } catch (error) {
    console.warn('[recently-viewed] Could not save browser history:', error.message);
  }
}

export function useRecentlyViewed(listing) {
  const { status } = useAuthContext();
  const [items, setItems] = useState(readLocalRecentlyViewed);

  useEffect(() => {
    let active = true;
    if (status === 'authed') {
      api.getRecentlyViewed()
        .then(({ items: saved = [] }) => {
          if (active && saved.length) setItems(saved);
        })
        .catch((error) => console.error('[recently-viewed] Could not sync buyer history:', error.message));
    }
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    const listingId = listing?.id || listing?._id;
    const listingType = listing?.type || listing?.listingType;
    if (!listingId || !['product', 'course', 'service'].includes(listingType)) return;
    const item = { listingType, listingId: String(listingId), listing };
    const next = [
      item,
      ...readLocalRecentlyViewed().filter((entry) => !(entry.listingType === listingType && String(entry.listingId) === String(listingId))),
    ].slice(0, 10);
    setItems(next);
    writeLocalRecentlyViewed(next.reverse());
    if (status === 'authed') {
      api.trackRecentlyViewed(listingType, String(listingId))
        .catch((error) => console.error('[recently-viewed] Could not sync listing view:', error.message));
    }
  }, [listing, status]);

  return items;
}
