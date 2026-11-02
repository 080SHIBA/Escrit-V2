import { useCallback } from 'react';
import { api } from './api.js';
import { transitionOrder } from '../shared/orderState.js';
import { deliveryReleaseTime } from '../shared/orderState.js';
import { useCachedQuery } from '../hooks/useCachedQuery.js';

// WHAT: orders for a role ('buy' or 'sell'), cached in memory per role.
// WHY memory only ("u:" key): orders are personal data. They are wiped on
// login/logout (see AuthContext) so they can never appear for another account.
// WHY a short stale time: order status changes often, so revisits show the
// last known list instantly but always refresh it right away.
export function useOrders(role) {
  const { data, error, refetch, setData } = useCachedQuery(
    `u:orders:${role}`,
    async () => {
      const { orders } = await api.getOrders(role);
      return Array.isArray(orders) ? orders : [];
    },
    { staleTime: 10_000 },
  );

  // WHY keep the old name and shape: BuyerOrders passes updater functions to
  // setOrders for optimistic updates; the cache setter supports the same call.
  const setOrders = useCallback((next) => setData(next), [setData]);

  return {
    // WHY null while loading: the page uses null to decide when to show skeletons.
    orders: data ?? null,
    setOrders,
    error: error ? 'We couldn’t load these orders. Please try again.' : '',
    retry: refetch,
  };
}

export function useOrderActions() {
  const perform = useCallback(async (order, action, role, payload = {}) => {
    const optimistic = transitionOrder(order, action, role);
    if (action === 'deliver') {
      optimistic.deliveredAt = new Date().toISOString();
      optimistic.releaseDueAt = deliveryReleaseTime(
        optimistic.deliveredAt,
        optimistic.releaseWindowHours,
      ).toISOString();
    }
    if (action === 'dispute') optimistic.disputeReason = payload.reason;

    const result = await api.updateOrder(order.id, action, payload);
    return { ...optimistic, ...(result.order || {}) };
  }, []);
  return { perform };
}
