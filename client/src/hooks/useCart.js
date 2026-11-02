import { useCallback, useMemo } from 'react';
import { api } from '../lib/api.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { useCachedQuery } from './useCachedQuery.js';

const CART_KEY = 'u:cart-ids';

// WHAT: the ids of listings currently in the buyer's cart, shared by every card.
// WHY cached: "Add to cart" vs "In cart" buttons are correct on first paint.
// WHY gated on 'authed': see useSaved; anonymous visitors have no cart.
export function useCart() {
  const { status } = useAuthContext();
  const { data, setData, refetch } = useCachedQuery(
    CART_KEY,
    async () => {
      const { items = [] } = await api.getMarketplaceCart();
      return items.map((item) => item.id);
    },
    { enabled: status === 'authed', staleTime: 15_000 },
  );

  const cartIds = useMemo(() => new Set(data || []), [data]);

  const addToCart = useCallback(async (listing, options = {}) => {
    const wasInCart = cartIds.has(listing.id);
    setData((current = []) => (current.includes(listing.id) ? current : [...current, listing.id]));
    try {
      await api.addMarketplaceCartItem(listing, options);
    } catch (error) {
      // WHY roll back only if we added it: do not remove an item that was already there.
      if (!wasInCart) setData((current = []) => current.filter((id) => id !== listing.id));
      throw error;
    }
  }, [cartIds, setData]);

  const removeFromCart = useCallback(async (listing) => {
    const wasInCart = cartIds.has(listing.id);
    setData((current = []) => current.filter((id) => id !== listing.id));
    try {
      await api.removeMarketplaceCartItem(listing.id, listing.type);
    } catch (error) {
      if (wasInCart) setData((current = []) => (current.includes(listing.id) ? current : [...current, listing.id]));
      throw error;
    }
  }, [cartIds, setData]);

  return { cartIds, addToCart, removeFromCart, refreshCart: refetch };
}
