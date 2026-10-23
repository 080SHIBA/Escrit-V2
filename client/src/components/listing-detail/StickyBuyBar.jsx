export default function StickyBuyBar({ listing, disabled, onAddToCart }) {
  if (listing.type === 'product' && Number(listing.stock) < 1) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-card-lg backdrop-blur min-[860px]:hidden">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-base font-semibold">₦{Number(listing.price).toLocaleString('en-NG')}</p>
        <button type="button" onClick={onAddToCart} disabled={disabled} className="min-h-11 shrink-0 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          Add to cart
        </button>
      </div>
    </div>
  );
}
