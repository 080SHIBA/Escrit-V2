import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { getDefaultPaymentOption } from '../lib/listingDetailState.js';
import { useCart } from './useCart.js';
import { useSaved } from './useSaved.js';

// WHAT: the "save" and "add to cart" actions for listing cards, with sign-in
// handling and always-visible feedback. Used by the marketplace grid.
//
// WHY one shared hook: the grid and the detail page each had their own copy of
// this logic, and the grid copy was missing the sign-in check. A signed-out
// visitor who tapped the heart sent a request that could only fail, and the
// failure message vanished after three seconds, so it looked like nothing had
// happened ("favourites fail silently"). Centralising it means every surface
// behaves the same and a fix lands everywhere.
//
// `notify(message, tone)` is supplied by the page so each page keeps its own
// toast UI. tone is 'success' or 'error'.
export function useListingActions({ notify }) {
  const { status } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { cartIds, addToCart } = useCart();
  const { savedIds, toggleSaved } = useSaved();

  // WHAT: send a signed-out visitor to sign in, then bring them back here.
  // WHY: the action cannot succeed without an account, so say so plainly and make
  // the next step one tap instead of failing quietly.
  const requireSignIn = useCallback((reason) => {
    notify(reason, 'error');
    const next = `${location.pathname}${location.search}`;
    navigate(`/sign-in?intent=buyer&next=${encodeURIComponent(next)}`);
  }, [location.pathname, location.search, navigate, notify]);

  const handleToggleSaved = useCallback(async (listing) => {
    // WHY status check: 'checking' means the session is still being restored.
    // Treat only a definite signed-out state as "needs sign-in", and tell the
    // visitor to wait if we are not sure yet, rather than firing a doomed request.
    if (status === 'checking') {
      notify('Still checking your sign-in. Try again in a moment.', 'error');
      return;
    }
    if (status !== 'authed') {
      requireSignIn('Sign in to save listings.');
      return;
    }
    try {
      const saved = await toggleSaved(listing);
      notify(saved ? `${listing.title} saved for later.` : 'Removed from saved listings.', 'success');
    } catch (error) {
      // WHY show error.message: the server's reason ("Listing is no longer
      // available", "session expired") tells the buyer what to do next.
      notify(error?.message || 'We couldn’t update your saved listings. Please try again.', 'error');
    }
  }, [notify, requireSignIn, status, toggleSaved]);

  const handleAddToCart = useCallback(async (listing) => {
    if (status === 'checking') {
      notify('Still checking your sign-in. Try again in a moment.', 'error');
      return;
    }
    if (status !== 'authed') {
      requireSignIn('Sign in to add items to your cart.');
      return;
    }
    // WHAT: a concrete fulfilment method, or '' for "let the server choose".
    // WHY: listings that offer both delivery and pickup are labelled
    // 'delivery-or-pickup'. That is a description, not a choice, and sending it
    // made the server reject the request, which is why add-to-cart "didn't work"
    // on those listings. The buyer picks delivery or pickup later in the cart.
    const method = listing.fulfillmentMethod;
    const fulfilment = listing.type === 'product' && ['delivery', 'pickup', 'digital-download'].includes(method) ? method : '';
    try {
      await addToCart(listing, {
        paymentOption: getDefaultPaymentOption(listing.paymentOptions),
        fulfilment,
        quantity: 1,
      });
      notify(`${listing.title} added to cart.`, 'success');
    } catch (error) {
      notify(error?.message || 'We couldn’t add this listing to your cart. Please try again.', 'error');
    }
  }, [addToCart, notify, requireSignIn, status]);

  return { cartIds, savedIds, handleToggleSaved, handleAddToCart };
}
