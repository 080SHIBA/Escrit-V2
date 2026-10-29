import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, Send } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import OfferCard from './OfferCard.jsx';
import PayBar from './PayBar.jsx';
import DeliveryCard from './DeliveryCard.jsx';
import { getConversationStage } from '../../lib/serviceChat.js';

function otherParticipant(offer, role) {
  return role === 'buyer' ? offer?.sellerId : offer?.buyerId;
}

function participantName(participant) {
  return participant?.displayName || participant?.businessName || 'Escrit member';
}

export default function ChatThread({
  role,
  offer,
  order,
  messages,
  loading,
  hasMore,
  online,
  typing,
  busy,
  error,
  onBack,
  onShowDetails,
  onLoadOlder,
  onSend,
  onRetry,
  onTyping,
  onSendOffer,
  onAcceptOffer,
  onCounterOffer,
  onDeclineOffer,
  onPay,
  onStart,
  onDeliver,
  onComplete,
  onDispute,
  onOpenDelivery,
}) {
  const [draft, setDraft] = useState('');
  const [offerForm, setOfferForm] = useState(false);
  const [offerDraft, setOfferDraft] = useState({ priceNaira: '', timeline: '', scope: '' });
  const listRef = useRef(null);
  const headingRef = useRef(null);
  const endRef = useRef(null);
  const scrollHeightRef = useRef(0);
  const newestMessageId = messages.at(-1)?._id;
  const other = otherParticipant(offer, role);
  const name = participantName(other);
  const serviceTitle = offer?.serviceId?.title || 'Service conversation';
  const latestOfferMessage = [...messages].reverse().find((message) => message.type === 'offer');
  const stage = getConversationStage(offer, order);
  const isPaid = order?.paymentStatus === 'paid';

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [offer?._id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [newestMessageId]);

  async function submitMessage(event) {
    event.preventDefault();
    const sent = await onSend(draft);
    if (sent) setDraft('');
    onTyping(false);
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-paper" aria-label="Chat">
      {offer ? (
        <>
          <header className="flex min-h-16 items-center gap-3 border-b border-line px-3 py-2 sm:px-4">
            <button type="button" onClick={onBack} aria-label="Back to conversations" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus lg:hidden"><ArrowLeft size={18} aria-hidden="true" /></button>
            {other?.profilePictureUrl
              ? <img src={other.profilePictureUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              : <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 font-semibold text-accent">{name.charAt(0).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <h2 ref={headingRef} tabIndex="-1" className="truncate font-semibold focus:outline-none">{name}</h2>
              <p className="mt-0.5 truncate text-xs text-ink/55">{other?.kycStatus === 'verified' ? 'Verified' : 'Verification pending'} <span aria-hidden="true">·</span> {serviceTitle}</p>
            </div>
            <span className={`hidden shrink-0 items-center gap-1.5 text-xs sm:inline-flex ${online ? 'text-released' : 'text-ink/45'}`}><span className={`h-2 w-2 rounded-full ${online ? 'bg-released' : 'bg-line-strong'}`} />{online ? 'Online' : 'Offline'}</span>
            <button type="button" onClick={onShowDetails} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus lg:hidden"><MoreHorizontal size={16} aria-hidden="true" />Details</button>
          </header>
          <div className="border-b border-accent/20 bg-accent/5 px-4 py-2.5 text-xs leading-5 text-ink/65">
            Keep payment and agreements in Escrit. Escrit cannot recover money paid outside the platform.
          </div>
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
            onScroll={(event) => {
              const element = event.currentTarget;
              if (element.scrollTop <= 24 && hasMore && !loading && element.scrollHeight !== scrollHeightRef.current) {
                scrollHeightRef.current = element.scrollHeight;
                onLoadOlder();
              }
            }}
          >
            {hasMore && <button type="button" onClick={onLoadOlder} className="mx-auto mb-4 flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold text-accent hover:bg-accent/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Load older messages</button>}
            {loading && messages.length === 0 && <p className="py-10 text-center text-sm text-ink/55">Opening your conversation…</p>}
            <ol aria-label="Messages" aria-live="polite" aria-relevant="additions text" role="log" className="space-y-3">
              {messages.map((message) => {
                const mine = role === 'seller'
                  ? String(message.senderId?._id || message.senderId) === String(offer.sellerId?._id || offer.sellerId)
                  : String(message.senderId?._id || message.senderId) === String(offer.buyerId?._id || offer.buyerId);
                const isCurrentOffer = message._id === latestOfferMessage?._id;
                return (
                  <MessageBubble key={message._id || message.clientMessageId} message={message} mine={mine} onRetry={onRetry}>
                    {message.type === 'offer' ? (
                      <OfferCard
                        offer={offer}
                        message={message}
                        role={role}
                        current={isCurrentOffer}
                        busy={busy}
                        onAccept={onAcceptOffer}
                        onCounter={onCounterOffer}
                        onDecline={onDeclineOffer}
                      />
                    ) : undefined}
                  </MessageBubble>
                );
              })}
            </ol>
            {typing && <p aria-live="polite" className="mt-3 text-xs text-ink/50">{name} is typing…</p>}
            <div ref={endRef} />
          </div>
          <div className="max-h-[42%] min-h-0 space-y-3 overflow-y-auto border-t border-line p-3 sm:p-4">
            {error && <p role="alert" className="rounded-lg border border-dispute/25 bg-dispute/5 px-3 py-2 text-sm text-dispute">{error}</p>}
            {offer.status === 'ACCEPTED' && order && order.paymentStatus !== 'paid' && (
              <PayBar offer={offer} order={order} busy={busy} onPay={onPay} />
            )}
            {order?.status === 'ready_to_start' && role === 'seller' && (
              <button type="button" disabled={busy} onClick={onStart} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Start work</button>
            )}
            {order && (['in_progress', 'delivered', 'completed'].includes(order.status) || order.status === 'disputed') && (
              <>
                {order.paymentStatus === 'processing' && <p role="status" className="text-sm text-ink/65">Waiting for the payment provider to confirm.</p>}
                {isPaid && <DeliveryCard
                  role={role}
                  order={order}
                  busy={busy}
                  onDeliver={onDeliver}
                  onComplete={onComplete}
                  onDispute={onDispute}
                  onOpenDelivery={onOpenDelivery}
                />}
              </>
            )}
            {role === 'seller' && ['REQUESTED', 'CHANGES_REQUESTED'].includes(offer.status) && (
              offerForm ? (
                <form
                  className="rounded-xl border border-line bg-paper-2 p-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const sent = await onSendOffer({ ...offerDraft, deliverables: [] });
                    if (sent) setOfferForm(false);
                  }}
                >
                  <h3 className="font-semibold">Send an offer</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-ink/65">Price (₦)<input type="number" min="100" required value={offerDraft.priceNaira} onChange={(event) => setOfferDraft((current) => ({ ...current, priceNaira: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" /></label>
                    <label className="text-xs font-medium text-ink/65">Delivery time<input type="text" maxLength={500} required value={offerDraft.timeline} onChange={(event) => setOfferDraft((current) => ({ ...current, timeline: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" placeholder="For example, 5 working days" /></label>
                  </div>
                  <label className="mt-3 block text-xs font-medium text-ink/65">What’s included<textarea minLength={5} maxLength={5000} required rows={3} value={offerDraft.scope} onChange={(event) => setOfferDraft((current) => ({ ...current, scope: event.target.value }))} className="mt-1 w-full rounded-lg border border-line bg-input px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" /></label>
                  <div className="mt-3 flex gap-2">
                    <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{busy ? 'Sending…' : 'Send offer'}</button>
                    <button type="button" onClick={() => setOfferForm(false)} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Cancel</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setOfferForm(true)} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Send an offer</button>
              )
            )}
            {role === 'buyer' && order?.paymentStatus === 'paid' && order?.status === 'in_progress' && <p className="rounded-lg bg-paper-2 px-3 py-2 text-sm text-ink/65">Work in progress. You’ll be able to review delivery here.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setDraft('Suggest a time'); }} className="min-h-11 rounded-full border border-line px-3 text-xs font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Suggest a time</button>
              <button type="button" onClick={() => { setDraft('Share requirements'); }} className="min-h-11 rounded-full border border-line px-3 text-xs font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Share requirements</button>
            </div>
            <form onSubmit={submitMessage} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="chat-message-input">Message</label>
              <textarea
                id="chat-message-input"
                value={draft}
                maxLength={2000}
                rows={1}
                onChange={(event) => {
                  setDraft(event.target.value);
                  onTyping(Boolean(event.target.value));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Write a message…"
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-lg border border-line bg-input px-3 py-2.5 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              />
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                <Send size={17} aria-hidden="true" />
              </button>
            </form>
            <p className="text-[11px] leading-4 text-ink/45">Keep contact details and payment outside Escrit out of chat.</p>
            <span className="sr-only">{stage}</span>
          </div>
        </>
      ) : (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div><h2 className="font-display text-xl">Pick a conversation</h2><p className="mt-2 text-sm text-ink/55">Your service offers and messages will show here.</p></div>
        </div>
      )}
    </section>
  );
}
