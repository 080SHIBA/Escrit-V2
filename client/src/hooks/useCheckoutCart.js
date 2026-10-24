import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import {
  cartItemKey,
  cartNeedsDeliveryAddress,
  createIdempotencyKey,
  isDeliveryAddressValid,
  PAYMENT_FAILURE_MESSAGE,
  resolveCartFulfilment,
  resolveOrderPaymentChoice,
} from '../lib/cartCheckout.js';

const CHECKOUT_KEY = 'escrit:checkout-idempotency-key';
const PAID_STATUSES = new Set([
  'PAID_HELD',
  'DIRECT_PAID',
  'DIRECT_COMPLETED',
  'RELEASED',
  'DISPUTED',
  'RESOLVED_RELEASED',
  'RESOLVED_REFUNDED',
  'RESOLVED_CREDITED',
]);

export function useCheckoutCart(reference = '') {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(reference ? 'payment' : 'cart');
  const [choices, setChoices] = useState({});
  const [review, setReview] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const items = cart?.items || [];
  const requiresAddress = useMemo(() => cartNeedsDeliveryAddress(items), [items]);
  const addressValid = !requiresAddress || isDeliveryAddressValid(cart?.deliveryAddress);

  const reload = useCallback(async () => {
    setError('');
    try {
      setCart(await api.getCart());
    } catch (nextError) {
      setError(nextError.message || 'We couldn’t load your cart. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!reference) return undefined;
    let active = true;
    let attempts = 0;
    setStep('payment');
    setPaymentMessage('');

    async function checkStatus() {
      try {
        const result = await api.getCheckoutStatus(reference);
        if (!active) return;
        if (result.status === 'confirmed' || result.orders?.length && result.orders.every((order) => PAID_STATUSES.has(order.status))) {
          setConfirmation(result);
          setStep('confirmation');
          window.sessionStorage.removeItem(CHECKOUT_KEY);
          await reload();
          return;
        }
        if (result.status === 'failed') {
          await returnToReview(PAYMENT_FAILURE_MESSAGE, true);
          window.sessionStorage.removeItem(CHECKOUT_KEY);
          return;
        }
        attempts += 1;
        if (attempts >= 20) {
          await returnToReview(PAYMENT_FAILURE_MESSAGE, false);
          return;
        }
        window.setTimeout(checkStatus, 2500);
      } catch (statusError) {
        if (!active) return;
        console.error('[checkout] Could not verify payment status:', statusError.message);
        await returnToReview(PAYMENT_FAILURE_MESSAGE, false);
      }
    }

    async function returnToReview(message, canRetryWithNewKey) {
      setPaymentMessage(message);
      if (canRetryWithNewKey) window.sessionStorage.removeItem(CHECKOUT_KEY);
      try {
        const currentCart = await api.getCart();
        const orders = currentCart.items.map((item) => ({
          listingType: item.listingType,
          listingId: String(item.listing._id),
          quantity: item.listingType === 'product' ? Number(item.quantity || 1) : 1,
          fulfilment: item.listingType === 'product' ? resolveCartFulfilment(item) : '',
          paymentOption: resolveOrderPaymentChoice(
            item.listing,
            item.listing.paymentOption,
          ),
        }));
        const currentReview = await api.reviewCart({
          deliveryAddress: currentCart.deliveryAddress || '',
          orders,
        });
        if (!active) return;
        setCart(currentCart);
        setReview(currentReview);
        setTermsAccepted(false);
        setStep('review');
      } catch (reviewError) {
        if (!active) return;
        setError(reviewError.message || 'We couldn’t reopen your order review.');
        setStep('cart');
      }
    }

    checkStatus();
    return () => { active = false; };
  }, [reference, reload]);

  const updateAddress = useCallback(async (deliveryAddress) => {
    setCart((current) => current ? { ...current, deliveryAddress } : current);
  }, []);

  const updateItem = useCallback(async (item, patch) => {
    const key = cartItemKey(item);
    const previous = cart?.items?.find((entry) => cartItemKey(entry) === key);
    setBusy(true);
    setError('');
    try {
      const response = await api.patchCart({
        item: {
          listingType: item.listingType,
          listingId: String(item.listing._id),
          ...patch,
        },
      });
      setCart(response);
    } catch (nextError) {
      setError(nextError.message || 'We couldn’t update this item.');
      if (!previous) await reload();
    } finally {
      setBusy(false);
    }
  }, [cart?.items, reload]);

  const removeItem = useCallback(async (item) => {
    setBusy(true);
    setError('');
    try {
      setCart(await api.removeCartItem(item.listingType, String(item.listing._id)));
    } catch (nextError) {
      setError(nextError.message || 'We couldn’t remove this item.');
    } finally {
      setBusy(false);
    }
  }, []);

  const saveForLater = useCallback(async (item) => {
    setBusy(true);
    setError('');
    try {
      await api.addFavorite(item.listingType, String(item.listing._id));
      setCart(await api.removeCartItem(item.listingType, String(item.listing._id)));
    } catch (nextError) {
      setError(nextError.message || 'We couldn’t save this listing for later.');
      await reload();
    } finally {
      setBusy(false);
    }
  }, [reload]);

  const setPaymentChoice = useCallback((item, paymentOption) => {
    setChoices((current) => ({ ...current, [cartItemKey(item)]: paymentOption }));
  }, []);

  const selectedOrders = useMemo(() => items.map((item) => {
    const listing = item.listing;
    return {
      listingType: item.listingType,
      listingId: String(listing._id),
      quantity: item.listingType === 'product' ? Number(item.quantity || 1) : 1,
      fulfilment: item.listingType === 'product' ? resolveCartFulfilment(item) : '',
      paymentOption: resolveOrderPaymentChoice(listing, choices[cartItemKey(item)] || listing.paymentOption),
    };
  }), [choices, items]);

  const reviewOrder = useCallback(async () => {
    if (!addressValid || !items.length) return;
    setBusy(true);
    setError('');
    setPaymentMessage('');
    try {
      await api.patchCart({ deliveryAddress: cart?.deliveryAddress || '' });
      const nextReview = await api.reviewCart({
        deliveryAddress: cart?.deliveryAddress || '',
        orders: selectedOrders,
      });
      setReview(nextReview);
      setTermsAccepted(false);
      setStep('review');
    } catch (nextError) {
      setError(nextError.message || 'We couldn’t prepare your review. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [addressValid, cart?.deliveryAddress, items.length, selectedOrders]);

  const pay = useCallback(async () => {
    if (!termsAccepted || !review) return;
    setBusy(true);
    setError('');
    setPaymentMessage('');
    setStep('payment');
    try {
      let idempotencyKey = window.sessionStorage.getItem(CHECKOUT_KEY);
      if (!idempotencyKey) {
        idempotencyKey = createIdempotencyKey();
        window.sessionStorage.setItem(CHECKOUT_KEY, idempotencyKey);
      }
      const result = await api.payCart({
        idempotencyKey,
        termsAccepted,
        deliveryAddress: cart?.deliveryAddress || '',
        orders: selectedOrders,
      });
      if (result.status === 'confirmed' && !Array.isArray(result.orders)) {
        window.location.assign(`/cart?reference=${encodeURIComponent(result.reference)}`);
      } else if (result.status === 'confirmed') {
        setConfirmation(result);
        setStep('confirmation');
        window.sessionStorage.removeItem(CHECKOUT_KEY);
        await reload();
      } else if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      } else if (result.status === 'failed') {
        setPaymentMessage(result.errorMessage || PAYMENT_FAILURE_MESSAGE);
        setStep('review');
        window.sessionStorage.removeItem(CHECKOUT_KEY);
      } else {
        setPaymentMessage(PAYMENT_FAILURE_MESSAGE);
        setStep('review');
      }
    } catch (nextError) {
      console.error('[checkout] Payment could not be confirmed:', nextError.message);
      setPaymentMessage(PAYMENT_FAILURE_MESSAGE);
      setStep('review');
    } finally {
      setBusy(false);
    }
  }, [cart?.deliveryAddress, reload, review, selectedOrders, termsAccepted]);

  function setCurrentStep(nextStep) {
    setStep(nextStep);
    setPaymentMessage('');
  }

  return {
    cart,
    items,
    loading,
    busy,
    error,
    step,
    review,
    termsAccepted,
    setTermsAccepted,
    paymentMessage,
    confirmation,
    requiresAddress,
    addressValid,
    choices,
    selectedOrders,
    reload,
    updateAddress,
    updateItem,
    removeItem,
    saveForLater,
    setPaymentChoice,
    reviewOrder,
    pay,
    setCurrentStep,
    clearError: () => setError(''),
  };
}
