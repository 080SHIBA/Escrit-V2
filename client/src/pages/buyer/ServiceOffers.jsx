import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getAccessToken, getRealtimeUrl, api } from '../../lib/api.js';
import { serviceOrderMocksEnabled } from '../../lib/serviceOrderMocks.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { HandshakeIcon } from '../../components/icons.jsx';

const participantId = (participant) => String(participant?._id || participant?.id || participant || '');

export default function ServiceOffers() {
  const { offerId } = useParams();
  const { seller } = useAuthContext();
  const [offers, setOffers] = useState(null);
  const [offer, setOffer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [counterPrice, setCounterPrice] = useState('');
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const socketRef = useRef(null);
  const myId = String(seller?.id || seller?._id || '');
  const isBuyer = (currentOffer) => serviceOrderMocksEnabled || participantId(currentOffer?.buyerId) === myId;
  usePageTitle(offerId ? 'Service conversation' : 'Service offers and chats');

  useEffect(() => {
    let active = true;
    api.listServiceOffers()
      .then(({ offers: data }) => active && setOffers(data || []))
      .catch((err) => active && setError(err.message || 'Unable to load service offers.'));
    return () => { active = false; };
  }, [offerId]);

  useEffect(() => {
    if (!offerId) return undefined;
    let active = true;
    api.getOfferMessages(offerId)
      .then(({ offer: currentOffer, messages: conversation }) => {
        if (!active) return;
        setOffer(currentOffer);
        setMessages(conversation || []);
        setCounterPrice((currentOffer.currentPriceKobo / 100).toString());
      })
      .catch((err) => active && setError(err.message || 'Unable to load this conversation.'));

    if (serviceOrderMocksEnabled) return () => { active = false; };
    const socket = io(getRealtimeUrl(), { auth: { accessToken: getAccessToken() } });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('conversation:join', offerId, (result) => result?.ok && setOnline(result.otherOnline)));
    socket.on('conversation:message', (message) => {
      if (String(message.offerId) === String(offerId)) {
        setMessages((current) => current.some((entry) => entry._id === message._id) ? current : [...current, message]);
        if (String(message.senderId) !== myId) api.getOfferMessages(offerId).catch(() => {});
      }
    });
    socket.on('conversation:presence', ({ userId, online: isOnline }) => {
      if (String(userId) !== myId) setOnline(isOnline);
    });
    socket.on('conversation:typing', ({ userId, typing: isTyping }) => {
      if (String(userId) !== myId) setTyping(isTyping);
    });
    socket.on('conversation:read', ({ readerId }) => {
      if (String(readerId) !== myId) setMessages((current) => current.map((message) => String(message.senderId) === myId ? { ...message, readAt: new Date().toISOString() } : message));
    });
    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [offerId, myId]);

  async function refreshThread() {
    const data = await api.getOfferMessages(offerId);
    setOffer(data.offer);
    setMessages(data.messages || []);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const { message } = await api.sendOfferMessage(offerId, draft.trim());
      setMessages((current) => current.some((entry) => entry._id === message._id) ? current : [...current, message]);
      setDraft('');
    } catch (err) {
      setError(err.message || 'Unable to send message.');
    } finally {
      setBusy(false);
    }
  }

  async function act(action, payload) {
    setBusy(true);
    setError('');
    try {
      if (action === 'counter') await api.counterServiceOffer(offerId, payload);
      else if (action === 'accept') {
        const result = await api.acceptServiceOffer(offerId);
        if (isBuyer(offer)) {
          if (result.orderId) {
            if (serviceOrderMocksEnabled) {
              await refreshThread();
              setError('Payment is disabled in local service-order mock mode. The accepted quote is saved in Service orders.');
              return;
            }
            const checkout = await api.checkoutServiceOrder(result.orderId);
            window.location.assign(checkout.authorizationUrl);
          } else window.location.assign(`/r/${result.checkoutLinkId}`);
        }
      } else await api.rejectServiceOffer(offerId);
      await refreshThread();
      const { offers: updatedOffers } = await api.listServiceOffers();
      setOffers(updatedOffers || []);
    } catch (err) {
      setError(err.message || 'Unable to update the proposal.');
    } finally {
      setBusy(false);
    }
  }

  const canCounter = offer?.status === 'PROPOSED' && participantId(offer.sellerId) === myId && offer.counterCount === 0;
  const canAccept = (offer?.status === 'PROPOSED' && participantId(offer.sellerId) === myId) || (offer?.status === 'COUNTERED' && isBuyer(offer));
  const canReject = (offer?.status === 'PROPOSED' && participantId(offer.sellerId) === myId) || (offer?.status === 'COUNTERED' && isBuyer(offer));

  if (!offerId) {
    return (
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-line pb-5">
          <p className="text-xs uppercase tracking-wider text-ink/50">Account</p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl"><HandshakeIcon width={28} height={28} />Service offers and chats</h1>
        </header>
        {error && <p role="alert" className="mt-5 text-sm text-dispute">{error}</p>}
        {offers?.length === 0 && <p className="mt-6 border-y border-line py-8 text-sm text-ink/55">No service proposals yet. Start one from a service listing.</p>}
        {offers === null && !error && <p className="py-8 text-sm text-ink/55">Loading conversations…</p>}
        <ul className="mt-4 divide-y divide-line">
          {offers?.map((entry) => {
            const otherParty = participantId(entry.buyerId) === myId || serviceOrderMocksEnabled ? entry.sellerId : entry.buyerId;
            return <li key={entry._id}>
              <Link to={`/account/offers/${entry._id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:text-ink">
                <HandshakeIcon width={22} height={22} className="mr-1" />
                <div><p className="font-medium">{entry.serviceId?.title || 'Service deal'}</p><p className="mt-1 text-sm text-ink/55"><Link to={`/marketplace/seller/${otherParty?._id}`} className="hover:text-accent hover:underline">{otherParty?.displayName || otherParty?.businessName}</Link> · {entry.status.toLowerCase()}</p></div>
                <span className="font-mono text-sm">₦{(entry.currentPriceKobo / 100).toLocaleString()}</span>
              </Link>
            </li>;
          })}
        </ul>
      </div>
    );
  }

  if (!offer) return <div className="mx-auto max-w-4xl">{error ? <p role="alert" className="text-sm text-dispute">{error}</p> : <p className="py-8 text-sm text-ink/55">Loading conversation…</p>}</div>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/account/offers" className="text-sm text-ink/55 underline underline-offset-4">All offers</Link>
      <header className="mt-4 flex flex-wrap items-start justify-between gap-3 border-y border-line py-5">
        <div><p className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink/50"><HandshakeIcon width={16} height={16} />Service proposal · {offer.status.toLowerCase()}</p><h1 className="mt-1 font-display text-2xl">Agreed scope and conversation</h1><p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-ink/65">{offer.fulfilmentCriteria}</p>{offer.appointmentAt && <p className="mt-2 text-xs text-ink/55">Preferred appointment: {new Date(offer.appointmentAt).toLocaleString()}</p>}</div>
        <div className="text-right"><p className="text-xs text-ink/50">Current offer</p><p className="font-mono text-xl font-semibold">₦{(offer.currentPriceKobo / 100).toLocaleString()}</p></div>
      </header>

      <div className="mt-5 flex items-center gap-2 text-xs text-ink/55"><span className={`h-2 w-2 rounded-full ${online ? 'bg-released' : 'bg-line-strong'}`} />{online ? 'Other party online' : 'Other party offline'}{typing && <span>· typing…</span>}</div>
      <ol aria-label="Conversation" className="mt-3 max-h-[48vh] min-h-64 space-y-3 overflow-y-auto border-y border-line py-4">
        {messages.map((message) => {
          const mine = serviceOrderMocksEnabled || String(message.senderId) === myId;
          return <li key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <article className={`max-w-[85%] rounded-lg border px-3 py-2.5 ${mine ? 'border-ink/10 bg-ink/5' : 'border-line bg-paper'}`}>
              {message.type === 'offer' ? <OfferMessage message={message} /> : <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
              <p className="mt-1 text-right text-[10px] text-ink/40">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine && <span className={message.readAt ? 'ml-1 text-sky-600' : 'ml-1'}>{message.readAt ? '✓✓' : message.deliveredAt ? '✓✓' : '✓'}</span>}</p>
            </article>
          </li>;
        })}
      </ol>

      {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}
      {offer.status !== 'ACCEPTED' && offer.status !== 'REJECTED' && <div className="mt-4 flex flex-wrap gap-2">
        {canCounter && <div className="flex flex-1 gap-2"><input aria-label="Counter-offer amount" type="number" min="100" value={counterPrice} onChange={(event) => setCounterPrice(event.target.value)} className="min-w-0 flex-1 border border-line bg-input px-3 py-2" /><button disabled={busy} onClick={() => act('counter', { priceNaira: Number(counterPrice) })} className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium disabled:opacity-50">Counter once</button></div>}
        {canAccept && <button disabled={busy} onClick={() => act('accept')} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">Accept offer</button>}
        {canReject && <button disabled={busy} onClick={() => act('reject')} className="rounded-lg border border-dispute/50 px-4 py-2 text-sm text-dispute disabled:opacity-50">Decline</button>}
      </div>}
      {offer.status === 'ACCEPTED' && isBuyer(offer) && offer.acceptedOrderId && <button type="button" onClick={async () => {
        setBusy(true);
        setError('');
        try {
          const checkout = await api.checkoutServiceOrder(offer.acceptedOrderId);
          window.location.assign(checkout.authorizationUrl);
        } catch (err) {
          setError(err.message || 'Could not start service checkout.');
        } finally {
          setBusy(false);
        }
      }} disabled={busy} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">Continue to payment</button>}
      {offer.status === 'ACCEPTED' && isBuyer(offer) && offer.linkId && <Link to={`/r/${offer.linkId}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper">Continue to payment</Link>}
      <form onSubmit={sendMessage} className="mt-4 flex items-end gap-2 border-t border-line pt-4">
        <label className="min-w-0 flex-1 text-xs text-ink/55">Message
          <textarea value={draft} onChange={(event) => { setDraft(event.target.value); socketRef.current?.emit('conversation:typing', { offerId, typing: Boolean(event.target.value) }); }} rows={2} maxLength={2000} className="mt-1 w-full border border-line bg-input px-3 py-2 text-sm" placeholder="Discuss scope, timing, and details" />
        </label>
        <button disabled={busy || !draft.trim()} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}

function OfferMessage({ message }) {
  const event = message.offerEvent || {};
  return <div className="min-w-48"><p className="text-xs font-semibold uppercase tracking-wide text-seal">{event.action || 'Offer'}</p><p className="mt-1 font-mono font-semibold">₦{((event.priceKobo || 0) / 100).toLocaleString()}</p>{event.note && <p className="mt-1 text-xs text-ink/60">{event.note}</p>}</div>;
}