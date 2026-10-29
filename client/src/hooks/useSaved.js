import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export function useSaved() {
  const [savedIds, setSavedIds] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    api.getMarketplaceSaved()
      .then(({ items = [] }) => {
        if (active) {
          setSavedIds(new Set(items
            .map((item) => item.listing?._id || item.listing?.id || item.id)
            .filter(Boolean)
            .map(String)));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const toggleSaved = useCallback(async (listing) => {
    const listingId = String(listing.id);
    const wasSaved = savedIds.has(listingId);
    setSavedIds((current) => {
      const updated = new Set(current);
      if (wasSaved) updated.delete(listingId);
      else updated.add(listingId);
      return updated;
    });
    try {
      if (wasSaved) await api.removeSavedListing(listing.type, listing.id);
      else await api.saveListing(listing.type, listing.id);
      return !wasSaved;
    } catch (error) {
      setSavedIds((current) => {
        const updated = new Set(current);
        if (wasSaved) updated.add(listingId);
        else updated.delete(listingId);
        return updated;
      });
      throw error;
    }
  }, [savedIds]);

  return { savedIds, toggleSaved };
}
