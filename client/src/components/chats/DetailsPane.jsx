import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getConversationStage, paymentOptionCopy } from '../../lib/serviceChat.js';

export default function DetailsPane({ offer, order, onReport, onBack }) {
  const [reason, setReason] = useState('');
  const listing = offer?.serviceId || {};
  const paymentChoiceSaved = order?.termsSnapshot?.includes('Payment method:');
  const paymentMode = paymentChoiceSaved ? order.paymentMode : null;
  const stage = getConversationStage(offer, order);
  const listingId = listing._id || listing.id;

  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-line bg-paper" aria-labelledby="chat-details-heading">
      <header className="flex min-h-14 items-center justify-between border-b border-line px-4">
        <h2 id="chat-details-heading" tabIndex="-1" className="font-semibold">Details</h2>
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus lg:hidden">Back to chat</button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Listing</h3>
          <p className="mt-2 font-semibold leading-5">{listing.title || 'Service listing'}</p>
          <p className="mt-1 text-sm text-ink/55">{listing.serviceModel?.replaceAll('_', ' ') || 'Service'}</p>
          {listing.basePrice > 0 && <p className="mt-2 text-sm font-medium">From ₦{Number(listing.basePrice).toLocaleString('en-NG')}</p>}
          {listingId && <Link to={`/listing/${encodeURIComponent(listingId)}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">View listing</Link>}
        </section>
        <section className="border-t border-line pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Order status</h3>
          <p className="mt-2 inline-flex min-h-8 items-center rounded-full bg-paper-3 px-3 text-sm font-semibold">{stage}</p>
          {stage === 'Disputed' && <p className="mt-2 text-sm leading-5 text-dispute">The payment is held while the dispute is reviewed.</p>}
        </section>
        <section className="border-t border-line pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Payment option</h3>
          <p className="mt-2 text-sm font-medium">{paymentMode === 'direct' ? 'Without escrow' : paymentMode === 'escrow' ? 'Escrit escrow' : 'Choose before checkout'}</p>
          {paymentMode && <p className="mt-2 text-xs leading-5 text-ink/55">{paymentOptionCopy(paymentMode)}</p>}
        </section>
        <p className="rounded-lg bg-paper-2 p-3 text-xs leading-5 text-ink/60">Built-in scheduling comes later. Agree timing in chat.</p>
        <form
          className="border-t border-line pt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const reported = await onReport(reason);
            if (reported) setReason('');
          }}
        >
          <label className="block text-sm font-medium">
            Report this conversation
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} maxLength={1000} rows={3} className="mt-2 w-full rounded-lg border border-line bg-input px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" placeholder="Tell us what happened" />
          </label>
          <button type="submit" disabled={reason.trim().length < 5} className="mt-2 min-h-11 w-full rounded-lg border border-line px-3 text-sm font-semibold hover:border-dispute hover:text-dispute disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Send report</button>
        </form>
      </div>
    </aside>
  );
}
