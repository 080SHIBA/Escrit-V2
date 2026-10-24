import { Search } from 'lucide-react';

const SORT_OPTIONS = [
  ['newest', 'Newest'],
  ['price-low', 'Price low to high'],
  ['price-high', 'Price high to low'],
  ['top-rated', 'Top rated'],
];

export default function SearchBar({ query, onQueryChange, sort, onSortChange, listingLabel = 'products, services, courses' }) {
  const searchLabel = `Search ${listingLabel} or sellers`;

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
      <label className="relative block">
        <span className="sr-only">{searchLabel}</span>
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchLabel}
          className="h-12 w-full rounded-lg border border-line bg-input py-3 pl-11 pr-4 text-base text-ink placeholder:text-ink/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        />
      </label>
      <label className="block">
        <span className="sr-only">Sort listings</span>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-12 w-full rounded-lg border border-line bg-input px-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
