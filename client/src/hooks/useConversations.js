import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { friendlyChatError } from '../lib/serviceChat.js';

export function useConversations(role) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { offers = [] } = await api.listServiceOffers(role);
      setConversations(offers);
      setError('');
      return offers;
    } catch (requestError) {
      setError(friendlyChatError(requestError, 'Your conversations could not be loaded.'));
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    let active = true;
    api.listServiceOffers(role)
      .then(({ offers = [] }) => {
        if (active) {
          setConversations(offers);
          setError('');
        }
      })
      .catch((requestError) => {
        if (active) setError(friendlyChatError(requestError, 'Your conversations could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [role]);

  const unreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0),
    [conversations],
  );

  const openConversation = useCallback(async (payload) => {
    const { offer } = await api.openServiceConversation(payload);
    setConversations((current) => [offer, ...current.filter((entry) => entry._id !== offer._id)]);
    setError('');
    return offer;
  }, []);

  const replaceConversation = useCallback((offer) => {
    if (!offer?._id) return;
    setConversations((current) => [
      offer,
      ...current.filter((entry) => String(entry._id) !== String(offer._id)),
    ].sort((first, second) => new Date(second.updatedAt || second.createdAt) - new Date(first.updatedAt || first.createdAt)));
  }, []);

  return {
    conversations,
    loading,
    error,
    unreadCount,
    refresh,
    openConversation,
    replaceConversation,
    setError,
  };
}
