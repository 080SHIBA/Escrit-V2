import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { usePageTitle } from '../lib/usePageTitle.js';
import { useConversations } from '../hooks/useConversations.js';
import { useChatSocket } from '../hooks/useChatSocket.js';
import { serviceOrderMocksEnabled } from '../lib/serviceOrderMocks.js';
import { friendlyChatError, getConversationRole } from '../lib/serviceChat.js';
import ConversationList from '../components/chats/ConversationList.jsx';
import ChatThread from '../components/chats/ChatThread.jsx';
import DetailsPane from '../components/chats/DetailsPane.jsx';
import './ChatsPage.css';

export default function ChatsPage() {
  const [searchParams] = useSearchParams();
  const { seller } = useAuthContext();
  const [role, setRole] = useState('buyer');
  const [selectedId, setSelectedId] = useState('');
  const [mobilePane, setMobilePane] = useState('list');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const openedTarget = useRef('');
  const buyerConversations = useConversations('buyer');
  const sellerConversations = useConversations('seller');
  const activeConversations = role === 'buyer' ? buyerConversations : sellerConversations;
  const selectedConversation = activeConversations.conversations.find((entry) => String(entry._id) === String(selectedId)) || null;
  const chat = useChatSocket(selectedId || null, role);
  const offer = chat.offer || selectedConversation;
  const userId = String(seller?.id || seller?._id || '');
  const conversationRole = serviceOrderMocksEnabled
    ? role
    : getConversationRole(offer, userId) || role;

  usePageTitle('Service offers & chat');

  useEffect(() => {
    if (!selectedId && activeConversations.conversations.length > 0) {
      setSelectedId(String(activeConversations.conversations[0]._id));
      setMobilePane('list');
    } else if (selectedId && !activeConversations.conversations.some((entry) => String(entry._id) === String(selectedId))) {
      setSelectedId(activeConversations.conversations[0]?._id ? String(activeConversations.conversations[0]._id) : '');
      setMobilePane('list');
    }
  }, [activeConversations.conversations, selectedId]);

  const targetListingId = searchParams.get('listingId') || '';
  const targetSellerId = searchParams.get('sellerId') || '';
  const targetConversationId = searchParams.get('conversationId') || '';
  const targetType = searchParams.get('listingType') || 'service';
  const openConversation = buyerConversations.openConversation;

  useEffect(() => {
    if (!targetConversationId) return;
    const buyerMatch = buyerConversations.conversations.find((entry) => String(entry._id) === targetConversationId);
    const sellerMatch = sellerConversations.conversations.find((entry) => String(entry._id) === targetConversationId);
    if (buyerMatch) {
      setRole('buyer');
      setSelectedId(targetConversationId);
      setMobilePane('chat');
    } else if (sellerMatch) {
      setRole('seller');
      setSelectedId(targetConversationId);
      setMobilePane('chat');
    }
  }, [buyerConversations.conversations, sellerConversations.conversations, targetConversationId]);

  useEffect(() => {
    if (!targetListingId || !targetSellerId) return;
    const key = `${targetType}:${targetListingId}:${targetSellerId}`;
    if (openedTarget.current === key) return;
    openedTarget.current = key;
    setRole('buyer');
    if (targetType !== 'service') {
      setActionError('Product chat is not available yet. Service conversations are ready to use.');
      return;
    }
    openConversation({
      serviceId: targetListingId,
      sellerId: targetSellerId,
      fulfilmentCriteria: 'I’d like to discuss this service in Escrit chat.',
      termsAccepted: true,
    })
      .then((opened) => {
        setSelectedId(String(opened._id));
        setMobilePane('chat');
      })
      .catch((error) => setActionError(friendlyChatError(error, 'We couldn’t open this service conversation.')));
  }, [openConversation, targetListingId, targetSellerId, targetType]);

  useEffect(() => {
    if (chat.offer?._id) activeConversations.replaceConversation(chat.offer);
  }, [activeConversations.replaceConversation, chat.offer]);

  const buyerUnread = buyerConversations.unreadCount;
  const sellerUnread = sellerConversations.unreadCount;

  const chooseRole = (nextRole) => {
    setRole(nextRole);
    setSelectedId('');
    setSearch('');
    setMobilePane('list');
    setActionError('');
    setStatusMessage('');
  };

  const refreshThread = useCallback(async () => {
    await chat.refresh();
    const data = await api.listServiceOffers(role);
    activeConversations.conversations.forEach((entry) => {
      const updated = data.offers?.find((item) => String(item._id) === String(entry._id));
      if (updated) activeConversations.replaceConversation(updated);
    });
  }, [activeConversations.conversations, activeConversations.replaceConversation, chat.refresh, role]);

  async function runAction(action, successMessage = '') {
    setBusy(true);
    setActionError('');
    setStatusMessage('');
    try {
      await action();
      if (successMessage) setStatusMessage(successMessage);
      await refreshThread();
      return true;
    } catch (error) {
      setActionError(friendlyChatError(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const sendOffer = (payload) => runAction(async () => {
    const options = offer.paymentOptionsSnapshot || { escrow: true, direct: false };
    const paymentMode = options.escrow ? 'escrow' : 'direct';
    await api.sendServiceQuote(offer._id, {
      scope: payload.scope.trim(),
      priceNaira: Number(payload.priceNaira),
      timeline: payload.timeline.trim(),
      deliverables: payload.deliverables || [],
      paymentTerms: '',
      revisionLimit: 0,
      milestones: [],
      paymentMode,
    }, conversationRole);
  }, 'Offer sent. The buyer can review it in this conversation.');

  const acceptOffer = () => runAction(async () => {
    const result = await api.acceptServiceOffer(offer._id, { termsAccepted: true }, conversationRole);
    if (result.order) chat.setOrder(result.order);
    if (result.offer) chat.setOffer(result.offer);
  }, conversationRole === 'seller' ? 'Final offer sent to the buyer.' : 'Offer accepted. Choose a payment option when you’re ready.');

  const counterOffer = (priceNaira) => runAction(
    () => api.counterServiceOffer(offer._id, { priceNaira }, conversationRole),
    'Your counter-offer was sent.',
  );

  const declineOffer = () => runAction(() => api.rejectServiceOffer(offer._id, conversationRole), 'Offer declined.');

  const pay = ({ paymentMode, directPaymentRiskAccepted }) => runAction(async () => {
    const latest = chat.order || offer.order;
    if (!latest?._id) throw new Error('The accepted order could not be loaded. Refresh and try again.');
    const selection = await api.setServicePaymentOption(offer._id, {
      paymentMode,
      directPaymentRiskAccepted,
      actorRole: conversationRole,
    });
    if (selection.order) chat.setOrder(selection.order);
    if (selection.offer) chat.setOffer(selection.offer);
    if (serviceOrderMocksEnabled) {
      const result = await api.confirmMockServicePayment(
        latest._id,
        import.meta.env.VITE_SERVICE_CHAT_MOCK_PAYMENT_RESULT || 'success',
      );
      chat.setOrder(result.order);
      return;
    }
    const checkout = await api.checkoutServiceOrder(latest._id);
    if (!checkout?.authorizationUrl) throw new Error('The payment provider did not return a checkout link. Try again shortly.');
    window.location.assign(checkout.authorizationUrl);
  });

  const deliver = ({ files, note }) => runAction(async () => {
    if (!chat.order?._id) throw new Error('The service order could not be loaded.');
    const uploads = await Promise.all(files.map((file) => api.uploadServiceDeliveryFile(chat.order._id, file, conversationRole)));
    await api.updateServiceOrder(chat.order._id, 'deliver', {
      note: note.trim(),
      deliverables: uploads.map((item) => ({ assetId: item.assetId, note: '' })),
      actorRole: conversationRole,
    });
  }, 'Delivery shared with the buyer.');

  const complete = () => runAction(async () => {
    await api.updateServiceOrder(chat.order._id, 'accept', { note: 'Buyer confirmed completion.', actorRole: conversationRole });
  }, 'Completion confirmed.');

  const startWork = () => runAction(async () => {
    const result = await api.updateServiceOrder(chat.order._id, 'start', { note: 'Provider started work.', actorRole: conversationRole });
    if (result.order) chat.setOrder(result.order);
  }, 'Work started.');

  const dispute = (reason) => {
    if (!reason || reason.trim().length < 5) {
      setActionError('Add a short reason so Escrit can review the dispute.');
      return Promise.resolve();
    }
    return runAction(() => api.updateServiceOrder(chat.order._id, 'dispute', { reason: reason.trim(), actorRole: conversationRole }));
  };

  const reportConversation = (reason) => runAction(
    () => api.reportServiceConversation(offer._id, reason),
    'Thanks. Your conversation report was sent for review.',
  );

  const openDelivery = async (item) => {
    try {
      const { url } = await api.getServiceDeliveryFile(chat.order._id, item.assetId, conversationRole);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setActionError(friendlyChatError(error, 'This delivery file could not be opened.'));
    }
  };

  const listClass = mobilePane === 'list' ? 'flex' : 'hidden';
  const chatClass = mobilePane === 'chat' ? 'flex' : 'hidden';
  const detailsClass = mobilePane === 'details' ? 'flex' : 'hidden';

  return (
    <main className="chats-page mx-auto max-w-[1600px] px-3 pb-8 pt-5 sm:px-5 sm:pt-7">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Your service deals</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl">Service offers &amp; chat</h1>
        </div>
        <Link to="/marketplace/services" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Browse services</Link>
      </header>

      <div role="tablist" aria-label="Buying or selling conversations" className="mb-4 inline-flex min-h-12 items-center gap-1 rounded-xl border border-line bg-paper p-1">
        {[
          { key: 'buyer', label: 'Buying', count: buyerUnread },
          { key: 'seller', label: 'Selling', count: sellerUnread },
        ].map((tab) => (
          <button
            key={tab.key}
            id={`chat-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={role === tab.key}
            aria-controls="chat-workspace"
            onClick={() => chooseRole(tab.key)}
            className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${role === tab.key ? 'bg-accent text-accent-ink' : 'text-ink/65 hover:bg-paper-2 hover:text-ink'}`}
          >
            {tab.label}
            <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] ${role === tab.key ? 'bg-accent-ink/10' : 'bg-paper-3'}`}>{tab.count > 99 ? '99+' : tab.count}</span>
          </button>
        ))}
      </div>

      {(actionError || activeConversations.error || chat.error) && (
        <p role="alert" className="mb-3 rounded-lg border border-dispute/25 bg-dispute/5 px-3 py-2 text-sm text-dispute">
          {actionError || activeConversations.error || chat.error}
        </p>
      )}
      {statusMessage && <p role="status" aria-live="polite" className="mb-3 rounded-lg border border-released/25 bg-released/5 px-3 py-2 text-sm text-released">{statusMessage}</p>}

      <div
        id="chat-workspace"
        role="tabpanel"
        aria-labelledby={`chat-tab-${role}`}
        className="chat-workspace grid min-h-[36rem] gap-3"
      >
        <div className={`chat-workspace__list ${listClass} min-h-[36rem] min-w-0 flex-col`}>
          {activeConversations.loading && activeConversations.conversations.length === 0
            ? <div className="rounded-xl border border-line bg-paper p-4 text-sm text-ink/55" aria-busy="true">Loading conversations…</div>
            : <ConversationList
              role={role}
              conversations={activeConversations.conversations}
              selectedId={selectedId}
              onSelect={(conversation) => { setSelectedId(String(conversation._id)); setMobilePane('chat'); setActionError(''); setStatusMessage(''); }}
              search={search}
              onSearchChange={setSearch}
            />}
        </div>
        <div className={`chat-workspace__thread ${chatClass} min-h-[36rem] min-w-0 flex-col`}>
          <ChatThread
            role={conversationRole}
            offer={offer}
            order={chat.order || offer?.order || null}
            messages={chat.messages}
            loading={chat.loading}
            hasMore={chat.hasMore}
            online={chat.online}
            typing={chat.typing}
            busy={busy}
            error={actionError || chat.error}
            onBack={() => setMobilePane('list')}
            onShowDetails={() => setMobilePane('details')}
            onLoadOlder={chat.loadOlder}
            onSend={chat.sendMessage}
            onRetry={chat.retryMessage}
            onTyping={chat.setTypingStatus}
            onSendOffer={sendOffer}
            onAcceptOffer={acceptOffer}
            onCounterOffer={counterOffer}
            onDeclineOffer={declineOffer}
            onPay={pay}
            onDeliver={deliver}
            onStart={startWork}
            onComplete={complete}
            onDispute={dispute}
            onOpenDelivery={openDelivery}
          />
        </div>
        <div className={`chat-workspace__details ${detailsClass} min-h-[36rem] min-w-0 flex-col`}>
          {offer
            ? <DetailsPane offer={offer} order={chat.order || offer.order} onReport={reportConversation} onBack={() => setMobilePane('chat')} />
            : <aside className="hidden rounded-xl border border-line bg-paper p-4 text-sm text-ink/55 min-[1000px]:block">Choose a conversation to see its details.</aside>}
        </div>
      </div>
    </main>
  );
}
