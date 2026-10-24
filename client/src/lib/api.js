// Small fetch wrapper: every call shares the same auth header, JSON
// handling and error shape. The access token lives in memory only; the
// refresh token is an httpOnly cookie managed by the browser.
import { bankAccountMockHandlers, bankAccountMocksEnabled } from './bankAccountMocks.js';
import { orderMockHandlers, orderMocksEnabled } from './orderMocks.js';
import { kycMockHandlers, kycMocksEnabled } from './kycMocks.js';
import { listingMockHandlers, listingMocksEnabled } from './listingMocks.js';
import { marketplaceMockHandlers, marketplaceMocksEnabled } from './marketplaceMocks.js';
import { onboardingMockHandlers, onboardingMocksEnabled } from './onboardingMocks.js';
import { transactionPreferencesMockHandlers } from './transactionPreferencesMocks.js';
import { serviceOrderMockHandlers, serviceOrderMocksEnabled } from './serviceOrderMocks.js';
import { apiUrl } from './apiBase.js';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getRealtimeUrl() {
  return import.meta.env.DEV
    ? window.location.origin
    : import.meta.env.VITE_REALTIME_URL || import.meta.env.VITE_API_URL || window.location.origin;
}

// Empty in development (Vite proxies /api to the local server). In
// production, set VITE_API_URL to the API's full URL.
// Access tokens are short-lived, so an authed call can hit a 401 at any
// time. One refresh is shared by all concurrent 401s to avoid a burst of
// /auth/refresh requests.
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Session expired');
        accessToken = data.accessToken;
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(path, { method = 'GET', body, auth = false, signal } = {}, isRetry = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(apiUrl(`/api${path}`), {
    method,
    headers,
    credentials: 'include', // sends the refresh cookie
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  // Retry once after refreshing, but never for the refresh call itself.
  if (res.status === 401 && auth && !isRetry && path !== '/auth/refresh') {
    try {
      await refreshAccessToken();
      return request(path, { method, body, auth, signal }, true);
    } catch {
      accessToken = null;
      throw new Error('Your session expired. Please log in again.');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(data.details) ? data.details.join(' ') : '';
    throw new Error(details ? `${data.error || 'Validation failed'}: ${details}` : data.error || `Request failed (${res.status})`);
  }
  return data;
}

function notifyCartChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('escrit:cart-updated'));
}

async function onboardingRequest(method, body) {
  try {
    return await request('/me/onboarding', { method, body, auth: true });
  } catch (error) {
    if (error.message === 'Your session expired. Please log in again.') throw error;
    if (/failed to fetch|network|request failed \(\d{3}\)/i.test(error.message)) {
      throw new Error(method === 'GET'
        ? 'We couldn’t load your saved setup. You can continue and try again later.'
        : 'We couldn’t save your setup right now. You can continue and retry.');
    }
    throw error;
  }
}

function uploadKycRequest(formData, onProgress, retry = false) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl('/api/kyc'));
    xhr.withCredentials = true;
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and retry.'));
    xhr.onload = async () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* friendly fallback below */ }
      if (xhr.status === 401 && !retry) {
        try {
          await refreshAccessToken();
          resolve(uploadKycRequest(formData, onProgress, true));
        } catch {
          accessToken = null;
          reject(new Error('Your session expired. Please log in again.'));
        }
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const details = Array.isArray(data.details) ? data.details.join(' ') : '';
        reject(new Error(xhr.status >= 500
          ? 'We couldn’t submit your documents. Please try again.'
          : details || data.error || 'We couldn’t submit your documents. Please try again.'));
        return;
      }
      resolve(data);
    };
    xhr.send(formData);
  });
}

export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  refresh: () => request('/auth/refresh', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me', { auth: true }),
  googleConfig: () => request('/auth/google/config'),
  googleLogin: (idToken, returnTo = '') => request('/auth/google', { method: 'POST', body: { idToken, ...(returnTo ? { returnTo } : {}) } }),
  resendOtp: () => request('/auth/resend-otp', { method: 'POST', auth: true }),
  resendVerification: (email) => onboardingMocksEnabled
    ? Promise.resolve({ ok: true, mock: true })
    : request('/auth/resend-verification', { method: 'POST', body: { email } }),
  verifyOtp: (code) => request('/auth/verify-otp', { method: 'POST', body: { code }, auth: true }),
  getOnboarding: (account) => onboardingMocksEnabled
    ? onboardingMockHandlers.get(account)
    : onboardingRequest('GET'),
  getTransactionPreferences: () => listingMocksEnabled
    ? transactionPreferencesMockHandlers.get()
    : request('/me/transaction-preferences', { auth: true }),
  saveTransactionPreferences: (preferences) => listingMocksEnabled
    ? transactionPreferencesMockHandlers.save(preferences)
    : request('/me/transaction-preferences', { method: 'PATCH', body: preferences, auth: true }),
  saveOnboarding: (onboarding, account) => onboardingMocksEnabled
    ? onboardingMockHandlers.save(account, onboarding)
    : onboardingRequest('PATCH', onboarding),
  getEscrowLinkPreview: (linkId, transactionId = '') => onboardingMocksEnabled
    ? onboardingMockHandlers.preview(linkId, transactionId)
    : request(`/escrow-links/${encodeURIComponent(linkId)}/preview${transactionId ? `?transactionId=${encodeURIComponent(transactionId)}` : ''}`, { auth: true }),
  trackFunnelEvent: (event, linkId = '', transactionId = '') => onboardingMocksEnabled
    ? onboardingMockHandlers.track(event, linkId, transactionId)
    : request('/funnel-events', {
      method: 'POST',
      body: { event, linkId, transactionId },
      auth: event === 'returned_to_transaction',
    }),
  markEscrowRecipientPromptEligible: () => onboardingMocksEnabled
    ? onboardingMockHandlers.dismissRecipientScreen()
    : request('/me/retention-prompt/dismiss-screen', { method: 'POST', body: {}, auth: true }),
  completeEscrowReturn: () => onboardingMocksEnabled
    ? onboardingMockHandlers.completeRecipientFlow()
    : request('/me/onboarding/complete-escrow-return', { method: 'POST', body: {}, auth: true }),
  getEscrowRecipientPrompt: () => onboardingMocksEnabled
    ? onboardingMockHandlers.getRecipientPrompt()
    : request('/me/retention-prompt', { auth: true }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),

  // Seller: payout account
  listBanks: () => bankAccountMocksEnabled ? bankAccountMockHandlers.listBanks() : request('/seller/banks', { auth: true }),
  resolveBankAccount: (bankCode, accountNumber, { signal } = {}) => bankAccountMocksEnabled
    ? bankAccountMockHandlers.resolveAccount({ bankCode, accountNumber })
    : request(`/banks/resolve?bank=${encodeURIComponent(bankCode)}&account=${encodeURIComponent(accountNumber)}`, { auth: true, signal }),
  saveBankAccount: (payload) => bankAccountMocksEnabled
    ? bankAccountMockHandlers.saveAccount(payload)
    : request('/seller/bank-account', { method: 'POST', body: payload, auth: true }),
  getPayoutData: () => bankAccountMocksEnabled
    ? bankAccountMockHandlers.payoutData()
    : Promise.all([
      request('/marketplace/me/analytics', { auth: true }),
      request('/seller/payout-history', { auth: true }),
    ]).then(([analytics, history]) => ({
      summary: analytics.financialSummary,
      payouts: history.payouts,
    })),
  updateSellerProfile: (payload) => kycMocksEnabled
    ? kycMockHandlers.updateProfile(payload)
    : request('/profile', { method: 'PATCH', body: payload, auth: true }),
  getSellerProfile: (seller) => kycMocksEnabled
    ? kycMockHandlers.getProfile()
    : Promise.resolve({ seller }),
  getKyc: () => kycMocksEnabled ? kycMockHandlers.get() : request('/kyc', { auth: true }),
  submitKyc: (formData, onProgress) => kycMocksEnabled
    ? kycMockHandlers.submit(formData, onProgress)
    : uploadKycRequest(formData, onProgress),
  simulateKycApproval: () => {
    if (!kycMocksEnabled) return Promise.reject(new Error('Approval simulation is available in the local KYC demo only.'));
    return kycMockHandlers.approve();
  },
  getShopifyConnection: () => request('/shopify/connection', { auth: true }),
  connectShopify: (shopDomain) => request('/shopify/connect', { method: 'POST', body: { shopDomain }, auth: true }),
  disconnectShopify: () => request('/shopify/connection', { method: 'DELETE', auth: true }),
  syncShopifyProducts: () => request('/shopify/products/sync', { method: 'POST', body: {}, auth: true }),
  getShopifyDrafts: () => request('/shopify/drafts', { auth: true }),
  submitShopifyDraft: (id, payload) => request(`/shopify/drafts/${id}/submit`, { method: 'POST', body: payload, auth: true }),
  getShopifyOrders: () => request('/shopify/orders', { auth: true }),

  // Seller: payment links
  createLink: (payload) => request('/links', { method: 'POST', body: payload, auth: true }),
  listLinks: () => request('/links', { auth: true }),
  getLink: (id) => request(`/links/${id}`, { auth: true }),
  setLinkActive: (id, active) => request(`/links/${id}`, { method: 'PATCH', body: { active }, auth: true }),
  updateFulfillment: (linkId, txId, payload) => request(`/links/${linkId}/transactions/${txId}/fulfillment`, { method: 'PATCH', body: payload, auth: true }),
  submitSellerEvidence: (linkId, txId, payload) => request(`/links/${linkId}/transactions/${txId}/evidence`, { method: 'POST', body: payload, auth: true }),
  getUploadSignature: () => request('/links/upload-signature', { method: 'POST', auth: true }),
  getListingUploadSignature: () => request('/uploads', { method: 'POST', auth: true }),

  // Public, seller, and listing mock APIs share this listing shape.
  // @param {{ cursor?: string | number, limit?: number, type?: string, category?: string, q?: string, sort?: string }} params
  getListings: (params = {}) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getListings(params)
    : (() => {
      const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
      const suffix = query.toString();
      return request(`/listings${suffix ? `?${suffix}` : ''}`);
    })(),
  getListingDetail: (id) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getListing(id)
    : request(`/listings/${encodeURIComponent(id)}`),
  getListingDetailReviews: (id) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getListingReviews(id)
    : request(`/listings/${encodeURIComponent(id)}/reviews`),
  getRelatedListings: (id) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getRelatedListings(id)
    : request(`/listings/${encodeURIComponent(id)}/related`),
  reportListing: (id, reason, sellerId) => request(`/marketplace/seller/${encodeURIComponent(sellerId)}/report`, {
    method: 'POST',
    body: { reason: `Listing ${id}: ${reason}` },
    auth: true,
  }),
  getMarketplaceCart: () => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getCart()
    : request('/cart', { auth: true }).then(({ items = [], ...rest }) => ({
      ...rest,
      items: items.map((entry) => ({ id: entry.listing?._id, type: entry.listingType })),
    })),
  addMarketplaceCartItem: async (listing, options = {}) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.addCartItem({ type: listing.type, listingId: listing.id, ...options })
      : await request('/cart', { method: 'POST', body: { listingId: listing.id, listingType: listing.type, ...options }, auth: true });
    notifyCartChanged();
    return result;
  },
  removeMarketplaceCartItem: async (id, type) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.removeCartItem(id)
      : await request(`/cart/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
    notifyCartChanged();
    return result;
  },
  getMarketplaceSaved: () => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getSaved()
    : request('/saved', { auth: true }),
  saveListing: (type, id) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.saveListing(type, id)
    : request(`/saved/${encodeURIComponent(id)}`, { method: 'POST', body: { type }, auth: true }),
  removeSavedListing: (type, id) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.unsaveListing(type, id)
    : request(`/saved/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  getMarketplace: (type = 'product') => request(`/marketplace/${type}`),
  getCategories: (type) => request(`/marketplace/categories/${type}`),
  getMarketplaceOverview: () => request('/marketplace/overview'),
  getMarketplaceListing: (type, id) => request(`/marketplace/${type}/${id}`),
  directCheckout: (type, id, payload = {}) => request(`/marketplace/${type}/${id}/checkout`, { method: 'POST', body: payload, auth: true }),
  getServiceAvailability: (id, date) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.availability(id, date)
    : request(`/services/${encodeURIComponent(id)}/availability?date=${encodeURIComponent(date)}`),
  createServiceOrder: (id, payload) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.create(id, payload)
    : request(`/services/${encodeURIComponent(id)}/orders`, { method: 'POST', body: payload, auth: true }),
  checkoutServiceOrder: (id) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.checkout(id)
    : request(`/services/orders/${encodeURIComponent(id)}/checkout`, { method: 'POST', body: {}, auth: true }),
  getMyServiceOrders: () => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.list()
    : request('/services/orders/me', { auth: true }),
  sendServiceOrderMessage: (id, message) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.message(id, message)
    : request(`/services/orders/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { message }, auth: true }),
  updateServiceOrder: (id, action, payload = {}) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.update(id, action, payload)
    : request(`/services/orders/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: payload, auth: true }),
  getListingReviews: (type, id) => request(`/marketplace/${type}/${id}/reviews`),
  getReviewEligibility: (type, id, sellerId) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getReviewEligibility(type, id, sellerId)
    : request(`/marketplace/me/review-eligibility/${type}/${id}`, { auth: true }),
  createListingReview: (type, id, payload, sellerId) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.createReview(type, id, sellerId, payload)
    : request(`/marketplace/${type}/${id}/reviews`, { method: 'POST', body: payload, auth: true }),
  listServiceOffers: () => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.listOffers()
    : request('/service-offers', { auth: true }),
  createServiceOffer: (payload) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.createOffer(payload)
    : request('/service-offers', { method: 'POST', body: payload, auth: true }),
  getOfferMessages: (id) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.getOfferMessages(id)
    : request(`/service-offers/${id}/messages`, { auth: true }),
  sendOfferMessage: (id, body) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.sendOfferMessage(id, body)
    : request(`/service-offers/${id}/messages`, { method: 'POST', body: { body }, auth: true }),
  getNotifications: () => request('/notifications', { auth: true }),
  getNotificationPreferences: () => request('/notifications/preferences', { auth: true }),
  updateNotificationPreferences: (preferences) => request('/notifications/preferences', { method: 'PATCH', body: preferences, auth: true }),
  markNotificationRead: (id) => request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', auth: true }),
  counterServiceOffer: (id, payload) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.counterOffer(id, payload)
    : request(`/service-offers/${id}/counter`, { method: 'POST', body: payload, auth: true }),
  acceptServiceOffer: (id) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.acceptOffer(id)
    : request(`/service-offers/${id}/accept`, { method: 'POST', body: {}, auth: true }),
  rejectServiceOffer: (id) => serviceOrderMocksEnabled
    ? serviceOrderMockHandlers.rejectOffer(id)
    : request(`/service-offers/${id}/reject`, { method: 'POST', body: {}, auth: true }),
  listProductOffers: () => request('/product-offers', { auth: true }),
  createProductOffer: (payload) => request('/product-offers', { method: 'POST', body: payload, auth: true }),
  respondProductOffer: (id, decision) => request(`/product-offers/${id}/respond`, { method: 'POST', body: { decision }, auth: true }),
  getPublicSeller: (id, account = null) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getPublicSeller(id, account)
    : request(`/marketplace/seller/${encodeURIComponent(id)}`, { auth: Boolean(account) }),
  reportSeller: (id, reason) => request(`/marketplace/seller/${encodeURIComponent(id)}/report`, { method: 'POST', body: { reason }, auth: true }),
  previewListingPrice: (amount, discount) => {
    const params = new URLSearchParams({ amount: String(amount) });
    if (discount) {
      params.set('discountPercent', String(discount.percent));
      params.set('startsAt', discount.startsAt);
      params.set('endsAt', discount.endsAt);
    }
    return request(`/marketplace/price-preview?${params}`, { auth: true });
  },
  createMarketplaceListing: (type, payload) => request(`/marketplace/${type}`, { method: 'POST', body: payload, auth: true }),
  getListingDraft: () => listingMocksEnabled ? listingMockHandlers.getDraft() : request('/listings/draft', { auth: true }),
  saveListingDraft: (payload, id) => listingMocksEnabled
    ? listingMockHandlers.saveDraft(payload)
    : id
      ? request(`/listings/${id}`, { method: 'PATCH', body: { ...payload, status: 'draft' }, auth: true })
      : request('/listings', { method: 'POST', body: { ...payload, status: 'draft' }, auth: true }),
  publishListing: (payload) => listingMocksEnabled
    ? listingMockHandlers.publish(payload)
    : request('/listings', { method: 'POST', body: { ...payload, status: 'live' }, auth: true }),
  getCart: () => marketplaceMocksEnabled ? Promise.resolve(marketplaceMockHandlers.legacyCart()) : request('/cart', { auth: true }),
  patchCart: async (payload) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.patchCart(payload)
      : await request('/cart', { method: 'PATCH', body: payload, auth: true });
    notifyCartChanged();
    return result;
  },
  getBuyerOrders: () => request('/marketplace/me/orders', { auth: true }),
  getOrders: (role) => orderMocksEnabled
    ? orderMockHandlers.list(role)
    : request(`/orders?role=${role}`, { auth: true }),
  updateOrder: (id, action, payload = {}) => orderMocksEnabled
    ? orderMockHandlers.action(action === 'deliver' ? 'sell' : 'buy', id, action, payload)
    : request(`/orders/${id}/${action}`, { method: 'POST', body: payload, auth: true }),
  getSellerAnalytics: () => request('/marketplace/me/analytics', { auth: true }),
  getPlatformCredits: () => request('/marketplace/me/credits', { auth: true }),
  spendPlatformCredits: (payload) => request('/marketplace/me/credits/spend', { method: 'POST', body: payload, auth: true }),
  getMyListings: () => listingMocksEnabled ? listingMockHandlers.getMyListings() : request('/marketplace/me/listings', { auth: true }),
  setMyListingActive: (type, id, active) => request(`/marketplace/me/listings/${type}/${id}`, { method: 'PATCH', body: { active }, auth: true }),
  addCartItem: async (listingType, listingId, options = {}) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.addCartItem({ type: listingType, listingId, ...options })
      : await request('/cart', { method: 'POST', body: { listingType, listingId, ...options }, auth: true });
    notifyCartChanged();
    return result;
  },
  reviewCart: (payload = {}) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.reviewCart(payload)
    : request('/checkout/review', { method: 'POST', body: payload, auth: true }),
  payCart: async (payload) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.payCart(payload)
      : await request('/checkout/pay', { method: 'POST', body: payload, auth: true });
    if (result.status === 'confirmed') notifyCartChanged();
    return result;
  },
  getCheckoutStatus: async (reference) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.getCheckoutStatus(reference)
      : await request(`/checkout/status/${encodeURIComponent(reference)}`, { auth: true });
    if (result.status === 'confirmed') notifyCartChanged();
    return result;
  },
  checkoutCart: (payload = {}) => request('/marketplace/me/cart/checkout', { method: 'POST', body: payload, auth: true }),
  getRecentlyViewed: () => marketplaceMocksEnabled
    ? marketplaceMockHandlers.getRecentlyViewed()
    : request('/me/recently-viewed', { auth: true }),
  trackRecentlyViewed: (listingType, listingId) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.trackRecentlyViewed(listingType, listingId)
    : request('/me/recently-viewed', { method: 'POST', body: { listingType, listingId }, auth: true }),
  getSimilarListings: (ids = []) => {
    const params = new URLSearchParams({ ids: ids.join(',') });
    return marketplaceMocksEnabled
      ? marketplaceMockHandlers.getSimilarListings(ids)
      : request(`/listings/similar?${params}`, { auth: true });
  },
  setCartQuantity: async (listingType, listingId, quantity) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.setQuantity(listingType, listingId, quantity)
      : await request('/cart', { method: 'PATCH', body: { item: { listingType, listingId, quantity } }, auth: true });
    notifyCartChanged();
    return result;
  },
  removeCartItem: async (listingType, listingId) => {
    const result = marketplaceMocksEnabled
      ? await marketplaceMockHandlers.removeCartItem(listingId)
      : await request(`/cart/${listingType}/${listingId}`, { method: 'DELETE', auth: true });
    notifyCartChanged();
    return result;
  },
  getFavorites: () => marketplaceMocksEnabled ? Promise.resolve(marketplaceMockHandlers.legacySaved()) : request('/marketplace/me/favorites', { auth: true }),
  addFavorite: (listingType, listingId) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.saveListing(listingType, listingId)
    : request('/marketplace/me/favorites', { method: 'POST', body: { listingType, listingId }, auth: true }),
  removeFavorite: (listingType, listingId) => marketplaceMocksEnabled
    ? marketplaceMockHandlers.unsaveListing(listingType, listingId)
    : request(`/marketplace/me/favorites/${listingType}/${listingId}`, { method: 'DELETE', auth: true }),

  // Buyer: a link is the shared product page; each checkout is its own order.
  getPublicLink: (linkId) => onboardingMocksEnabled
    ? onboardingMockHandlers.publicLink(linkId)
    : request(`/r/${linkId}`),
  checkout: (linkId, payload = {}) => request(`/r/${linkId}/checkout`, { method: 'POST', body: payload, auth: true }),
  getPublicTransaction: (linkId, txId) => request(`/r/${linkId}/t/${txId}`, { auth: true }),
  confirmReceipt: (linkId, txId) => request(`/r/${linkId}/t/${txId}/confirm-receipt`, { method: 'POST', auth: true }),
  raiseDispute: (linkId, txId, payload) => request(`/r/${linkId}/t/${txId}/dispute`, { method: 'POST', body: payload, auth: true }),
  reportDirectProblem: (linkId, txId, payload) => request(`/r/${linkId}/t/${txId}/complaint`, { method: 'POST', body: payload, auth: true }),
  reportServiceNoShow: (linkId, txId, payload) => request(`/r/${linkId}/t/${txId}/no-show-reason`, { method: 'POST', body: payload, auth: true }),
  submitBuyerEvidence: (linkId, txId, payload) => request(`/r/${linkId}/t/${txId}/evidence`, { method: 'POST', body: payload, auth: true }),
  resolveProductNoShow: (linkId, txId, outcome) => request(`/links/${linkId}/transactions/${txId}/no-show-resolution`, { method: 'POST', body: { outcome }, auth: true }),

  // Admin
  listDisputes: () => request('/admin/disputes', { auth: true }),
  listAdminComplaints: () => request('/admin/complaints', { auth: true }),
  resolveDispute: (id, payload) => request(`/admin/disputes/${id}/resolve`, { method: 'POST', body: payload, auth: true }),
  listAdminKyc: () => request('/admin/kyc', { auth: true }),
  reviewKyc: (id, payload) => request(`/admin/kyc/${id}/review`, { method: 'POST', body: payload, auth: true }),
  listUnverifiedListings: () => request('/admin/listings', { auth: true }),
  listCategoryRequests: () => request('/admin/categories', { auth: true }),
  listApprovedCategories: (type) => request(`/admin/categories/${type}/approved`, { auth: true }),
  reviewCategoryRequest: (type, id, payload) => request(`/admin/categories/${type}/${id}/review`, { method: 'POST', body: payload, auth: true }),
  reviewListing: (type, id, payload) => request(`/admin/listings/${type}/${id}/review`, { method: 'POST', body: payload, auth: true }),
  listAdminUsers: () => request('/admin/users', { auth: true }),
  setUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: 'PATCH', body: { role }, auth: true }),
  getPublicConfig: () => request('/public-config'),
  getPlatformSettings: () => request('/admin/settings', { auth: true }),
  updatePlatformSettings: (payload) => request('/admin/settings', { method: 'PATCH', body: payload, auth: true }),
  sendPromotionEmail: (payload) => request('/admin/promotions/email', { method: 'POST', body: payload, auth: true }),
  removeDemoData: () => request('/admin/demo-data', { method: 'DELETE', auth: true }),
};
