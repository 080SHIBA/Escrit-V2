import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { transitionOrder } from '../shared/orderState.js';
import { deliveryReleaseTime } from '../shared/orderState.js';

export function useOrders(role) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setOrders(null);
    setError('');
    api.getOrders(role)
      .then(({ orders: result }) => {
        if (active) setOrders(Array.isArray(result) ? result : []);
      })
      .catch(() => {
        if (active) setError('We couldn’t load these orders. Please try again.');
      });
    return () => { active = false; };
  }, [role, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);
  return { orders, setOrders, error, retry };
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
