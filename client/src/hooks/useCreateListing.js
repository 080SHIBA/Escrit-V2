import { useState } from 'react';
import { api } from '../lib/api.js';
import { friendlyListingError } from '../lib/listingState.js';

export function useCreateListing() {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(null);

  async function publish(form) {
    setPublishing(true);
    setError('');
    try {
      const result = await api.publishListing(form);
      setPublished({ ...result, url: `${window.location.origin}/marketplace/${result.listingType}/${result.item._id}` });
      return true;
    } catch (cause) {
      setError(friendlyListingError(cause));
      return false;
    } finally {
      setPublishing(false);
    }
  }

  function reset() {
    setPublished(null);
    setError('');
  }

  return { publishing, error, published, publish, reset, clearError: () => setError('') };
}
