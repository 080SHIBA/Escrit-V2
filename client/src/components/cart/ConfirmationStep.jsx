import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Store } from 'lucide-react';
import { formatNaira, groupCartBySeller } from '../../lib/cartCheckout.js';
import ChatNowButton from './ChatNowButton.jsx';

export default function ConfirmationStep({ confirmation }) {
  const [tab, setTab] = useState('orders');
  const orders = confirmation?.orders || [];
  const sellers = groupCartBySeller(confirmation?.contactItems || []);

  return (
    <section aria-labelledby="confirmation-heading" aria-live="polite">
      <div className="rounded-xl border border-released/30 bg-released/5 p-5 sm:p-7">
        <CheckCircle2 aria-hidden="true" className="text-released" size={32} />
        <h2 id="confirmation-heading" className="mt-3 font-display text-2xl">Payment confirmed</h2>
        <p className="mt-2 text-sm text-ink/65">Each listing has its own order record. Payment method and next steps are shown per order.</p>
      </div>
      <div role="tablist" aria-label="After checkout" className="mt-6 flex gap-2 border-b border-line">
        <button type="button" role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')} className="min-h-11 border-b-2 border-transparent px-4 text-sm font-semibold aria-selected:border-accent aria-selected:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Your orders</button>
        <button type="button" role="tab" aria-selected={tab === 'contact'} onClick={() => setTab('contact')} className="min-h-11 border-b-2 border-transparent px-4 text-sm font-semibold aria-selected:border-accent aria-selected:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Keep in touch</button>
      </div>
      {tab === 'orders' ? (
        <div role="tabpanel" className="mt-4 space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4">
              <div>
                <h3 className="font-semibold">{order.title || 'Escrit order'}</h3>
                <p className="mt-1 text-xs text-ink/55">Order {order.id}</p>
                <p className="mt-2 text-sm text-ink/65">{order.checkoutMode === 'escrow' ? 'Next: seller fulfils the order; confirm completion in your orders.' : 'Next: coordinate delivery or completion with the seller.'}</p>
              </div>
              <p className="font-semibold">{formatNaira(order.amountKobo)}</p>
            </article>
          ))}
        </div>
      ) : (
        <div role="tabpanel" className="mt-4 space-y-3">
          {sellers.length ? sellers.map((seller) => {
            const first = seller.items[0];
            return (
              <article key={seller.sellerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4">
                <div className="flex items-center gap-3">
                  <Store aria-hidden="true" className="text-ink/55" size={20} />
                  <div><h3 className="font-semibold">{seller.sellerName}</h3><p className="mt-1 text-xs text-ink/55">{seller.sellerVerified ? 'Verified' : 'Verification pending'}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/listing/${encodeURIComponent(first.listing._id)}`} className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Open listing</Link>
                  <Link to="/account/offers" className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Service offers &amp; chats</Link>
                  <ChatNowButton sellerId={seller.sellerId} listingId={first.listing._id} listingType={first.listingType} />
                </div>
              </article>
            );
          }) : <p className="rounded-lg border border-line p-4 text-sm text-ink/65">Open a purchased listing to contact its seller or discuss a service proposal.</p>}
          <p className="text-xs leading-5 text-ink/55">Product chat is available only when enabled. Service conversations remain in Service offers &amp; chats.</p>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to="/account/orders" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Track my orders</Link>
        <Link to="/marketplace" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Keep shopping</Link>
      </div>
    </section>
  );
}
