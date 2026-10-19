import { useMemo, useState } from 'react';

/**
 * @typedef {import('../lib/marketplaceState.js').Listing} Listing
 * @typedef {{ query: string, type: string, category: string }} ListingFilters
 */

/**
 * @param {Listing[]} listings
 * @param {ListingFilters} filters
 * @returns {Listing[]}
 */
export function filterLandingListings(listings, filters) {
  const query = filters.query.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);

  return listings.filter((listing) => {
    const searchable = `${listing.title} ${listing.category} ${listing.sellerName}`.toLocaleLowerCase();
    return (filters.type === 'all' || listing.type === filters.type)
      && (filters.category === 'all' || listing.category === filters.category)
      && terms.every((term) => searchable.includes(term));
  });
}

/**
 * @param {Listing[]} listings
 */
export function useListingFilters(listings) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');

  const filteredListings = useMemo(
    () => filterLandingListings(listings, { query, type, category }),
    [category, listings, query, type]
  );

  function clearFilters() {
    setQuery('');
    setType('all');
    setCategory('all');
  }

  return {
    query,
    setQuery,
    type,
    setType,
    category,
    setCategory,
    clearFilters,
    filteredListings,
    hasActiveFilters: Boolean(query || type !== 'all' || category !== 'all'),
  };
}
