import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import CartItem from './CartItem.jsx';
import ChatNowButton from './ChatNowButton.jsx';

export default function SellerGroup({ group, busy, viewMode = 'list', onUpdate, onRemove, onSaveForLater }) {
  const firstItem = group.items[0];
  const sellerLink = `/marketplace/seller/${encodeURIComponent(group.sellerId)}`;
  return (
    <section aria-labelledby={`seller-${group.sellerId}`} className="rounded-xl border border-line bg-paper p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper-2 text-ink/60"><Store aria-hidden="true" size={18} /></span>
          <div className="min-w-0">
            <h2 id={`seller-${group.sellerId}`} className="truncate font-semibold">
              <Link to={sellerLink} className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{group.sellerName}</Link>
            </h2>
            <p className="mt-1 text-xs text-ink/55">{group.sellerVerified ? 'Verified' : 'Verification pending'}</p>
          </div>
        </div>
        <ChatNowButton sellerId={group.sellerId} listingId={firstItem.listing._id} listingType={firstItem.listingType} />
      </header>
      <div className={viewMode === 'grid' ? 'grid gap-3 xl:grid-cols-2' : 'divide-y divide-line'}>
        {group.items.map((entry) => (
          <CartItem
            key={`${entry.listingType}:${entry.listing._id}`}
            entry={entry}
            busy={busy}
            viewMode={viewMode}
            wide={viewMode === 'grid' && group.items.length === 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onSaveForLater={onSaveForLater}
          />
        ))}
      </div>
    </section>
  );
}
