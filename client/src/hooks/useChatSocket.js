import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getAccessToken, getRealtimeUrl } from '../lib/api.js';
import { serviceOrderMocksEnabled } from '../lib/serviceOrderMocks.js';
import { containsContactDetails, friendlyChatError, mergeMessages } from '../lib/serviceChat.js';

function makeClientMessageId() {
  return globalThis.crypto?.randomUUID?.() || `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useChatSocket(conversationId, role = 'buyer') {
  const [offer, setOffer] = useState(null);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const socketRef = useRef(null);
  useEffect(() => {
    if (!conversationId) {
      setOffer(null);
      setOrder(null);
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    api.getOfferMessages(conversationId)
      .then((result) => {
        if (!active) return;
        setOffer(result.offer);
        setOrder(result.order || null);
        setMessages(result.messages || []);
        setHasMore(Boolean(result.hasMore));
        setNextCursor(result.nextCursor || null);
      })
      .catch((requestError) => {
        if (active) setError(friendlyChatError(requestError, 'This conversation could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    if (serviceOrderMocksEnabled) return () => { active = false; };

    const socket = io(getRealtimeUrl(), { auth: { accessToken: getAccessToken() } });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('conversation:join', conversationId, (result) => {
        if (result?.ok) setOnline(Boolean(result.otherOnline));
      });
    });
    socket.on('conversation:message', (message) => {
      if (String(message.offerId) === String(conversationId)) {
        setMessages((current) => mergeMessages(current, [message]));
      }
    });
    socket.on('conversation:offer', (updatedOffer) => {
      if (String(updatedOffer._id) === String(conversationId)) setOffer(updatedOffer);
    });
    socket.on('conversation:order', (updatedOrder) => {
      setOrder(updatedOrder);
      setOffer((current) => current
        ? { ...current, acceptedOrderId: updatedOrder._id, order: updatedOrder }
        : current);
    });
    socket.on('conversation:presence', ({ online: isOnline }) => setOnline(Boolean(isOnline)));
    socket.on('conversation:typing', ({ typing: isTyping }) => setTyping(Boolean(isTyping)));
    socket.on('conversation:read', () => {
      setMessages((current) => current.map((message) => ({ ...message, readAt: message.readAt || new Date().toISOString() })));
    });

    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMore || !nextCursor) return;
    try {
      const result = await api.getOfferMessages(conversationId, nextCursor);
      setMessages((current) => mergeMessages(result.messages || [], current));
      setHasMore(Boolean(result.hasMore));
      setNextCursor(result.nextCursor || null);
    } catch (requestError) {
      setError(friendlyChatError(requestError, 'Older messages could not be loaded.'));
    }
  }, [conversationId, hasMore, nextCursor]);

  const sendMessage = useCallback(async (value, retryMessage = null) => {
    const body = String(retryMessage?.body || value || '').trim();
    if (!body) return false;
    if (containsContactDetails(body)) {
      setError('For your safety, keep email addresses and phone numbers out of chat.');
      return false;
    }
    const clientMessageId = retryMessage?.clientMessageId || makeClientMessageId();
    const optimistic = {
      _id: clientMessageId,
      clientMessageId,
      offerId: conversationId,
      body,
      type: 'text',
      createdAt: retryMessage?.createdAt || new Date().toISOString(),
      optimistic: true,
    };
    setMessages((current) => mergeMessages(
      current.filter((message) => message.clientMessageId !== clientMessageId),
      [optimistic],
    ));
    setError('');
    try {
      const { message } = await api.sendOfferMessage(conversationId, body, clientMessageId, role);
      setMessages((current) => mergeMessages(current, [message]));
      return true;
    } catch (requestError) {
      setMessages((current) => current.map((message) => (
        message.clientMessageId === clientMessageId ? { ...message, optimistic: false, failed: true } : message
      )));
      setError(friendlyChatError(requestError, 'Your message could not be sent. Retry when you’re ready.'));
      return false;
    }
  }, [conversationId, role]);

  const setTypingStatus = useCallback((isTyping) => {
    socketRef.current?.emit('conversation:typing', { offerId: conversationId, typing: Boolean(isTyping) });
  }, [conversationId]);

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    try {
      const result = await api.getOfferMessages(conversationId);
      setOffer(result.offer);
      setOrder(result.order || null);
      setMessages((current) => mergeMessages(current, result.messages || []));
      setHasMore(Boolean(result.hasMore));
      setNextCursor(result.nextCursor || null);
      setError('');
    } catch (requestError) {
      setError(friendlyChatError(requestError, 'The conversation could not be refreshed.'));
    }
  }, [conversationId]);

  return {
    offer,
    order,
    messages,
    loading,
    hasMore,
    error,
    online,
    typing,
    loadOlder,
    sendMessage,
    retryMessage: (message) => sendMessage('', message),
    setTypingStatus,
    setOffer,
    setOrder,
    setError,
    refresh,
  };
}
