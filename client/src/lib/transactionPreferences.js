export const DEFAULT_TRANSACTION_PREFERENCES = Object.freeze({
  paymentDefault: 'both',
  fulfilmentDefault: 'delivery',
});

export const PAYMENT_DEFAULTS = Object.freeze({
  both: Object.freeze({ escrow: true, direct: true }),
  escrow: Object.freeze({ escrow: true, direct: false }),
  direct: Object.freeze({ escrow: false, direct: true }),
});

export const PAYMENT_DEFAULT_LABELS = Object.freeze({
  both: 'Escrow or pay without escrow',
  escrow: 'Escrow only',
  direct: 'Pay without escrow only',
});

export const FULFILMENT_DEFAULT_LABELS = Object.freeze({
  delivery: 'Seller-arranged delivery',
  pickup: 'Buyer pickup',
  both: 'Delivery or pickup',
});

export function paymentOptionsForDefault(paymentDefault = 'both') {
  return PAYMENT_DEFAULTS[paymentDefault] || PAYMENT_DEFAULTS.both;
}

export function paymentOptionsLabel(paymentOptions = PAYMENT_DEFAULTS.both) {
  if (paymentOptions.escrow && paymentOptions.direct) return 'Escrow optional';
  return paymentOptions.escrow ? 'Escrow only' : 'No escrow';
}

export function resolveListingPaymentOptions(listing, preferences = DEFAULT_TRANSACTION_PREFERENCES) {
  return listing.overridesDefault
    ? (listing.paymentOptions || paymentOptionsForDefault(preferences.paymentDefault))
    : paymentOptionsForDefault(preferences.paymentDefault);
}

export function resolveListingFulfilment(listing, preferences = DEFAULT_TRANSACTION_PREFERENCES) {
  if (listing.fulfillmentOverridesDefault) return listing.fulfillment || 'delivery';
  return preferences.fulfilmentDefault === 'both'
    ? 'delivery-or-pickup'
    : preferences.fulfilmentDefault || 'delivery';
}

export function validPaymentOptions(paymentOptions) {
  return Boolean(paymentOptions && (paymentOptions.escrow || paymentOptions.direct));
}
