import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export function useSaved() {
  const [savedIds, setSavedIds] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    api.getMarketplaceSaved()
      .then(({ items = [] }) => {
        if (active) setSavedIds(new Set(items.map((item) => item.id)));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const toggleSaved = useCallback(async (listing) => {
    const wasSaved = savedIds.has(listing.id);
    setSavedIds((current) => {
      const updated = new Set(current);
      if (wasSaved) updated.delete(listing.id);
      else updated.add(listing.id);
      return updated;
    });
    try {
      if (wasSaved) await api.removeSavedListing(listing.type, listing.id);
      else await api.saveListing(listing.type, listing.id);
      return !wasSaved;
    } catch (error) {
      setSavedIds((current) => {
        const updated = new Set(current);
        if (wasSaved) updated.add(listing.id);
        else updated.delete(listing.id);
        return updated;
      });
      throw error;
    }
  }, [savedIds]);

  return { savedIds, toggleSaved };
}
