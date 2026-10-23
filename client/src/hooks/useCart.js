import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export function useCart() {
  const [cartIds, setCartIds] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    api.getMarketplaceCart()
      .then(({ items = [] }) => {
        if (active) setCartIds(new Set(items.map((item) => item.id)));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const addToCart = useCallback(async (listing, options = {}) => {
    const wasInCart = cartIds.has(listing.id);
    setCartIds((current) => new Set(current).add(listing.id));
    try {
      await api.addMarketplaceCartItem(listing, options);
    } catch (error) {
      if (!wasInCart) setCartIds((current) => {
        const updated = new Set(current);
        updated.delete(listing.id);
        return updated;
      });
      throw error;
    }
  }, [cartIds]);

  const removeFromCart = useCallback(async (listing) => {
    const wasInCart = cartIds.has(listing.id);
    setCartIds((current) => {
      const updated = new Set(current);
      updated.delete(listing.id);
      return updated;
    });
    try {
      await api.removeMarketplaceCartItem(listing.id, listing.type);
    } catch (error) {
      if (wasInCart) setCartIds((current) => new Set(current).add(listing.id));
      throw error;
    }
  }, [cartIds]);

  return { cartIds, addToCart, removeFromCart };
}
