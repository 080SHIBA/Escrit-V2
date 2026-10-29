const contactPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?\d[\d\s().-]{6,}\d)/,
];

export function containsContactDetails(value) {
  const text = String(value || '');
  return contactPatterns.some((pattern) => pattern.test(text));
}

export function getConversationRole(conversation, userId) {
  const id = String(userId || '');
  if (String(conversation?.buyerId?._id || conversation?.buyerId?.id || conversation?.buyerId) === id) return 'buyer';
  if (String(conversation?.sellerId?._id || conversation?.sellerId?.id || conversation?.sellerId) === id) return 'seller';
  return null;
}

export function getConversationStage(offer, order = null) {
  if (order?.status === 'disputed' || offer?.status === 'DISPUTED') return 'Disputed';
  if (order?.status === 'completed') return 'Completed';
  if (order?.status === 'delivered') return 'Delivered';
  if (order?.paymentStatus === 'processing') return 'Payment pending';
  if (order?.paymentStatus === 'paid' || ['in_progress', 'ready_to_start', 'confirmed'].includes(order?.status)) return 'In progress';
  if (['QUOTED', 'PROPOSED', 'COUNTERED'].includes(offer?.status)) return 'Offer';
  if (offer?.status === 'ACCEPTED') return 'Offer accepted';
  if (offer?.status === 'REJECTED') return 'Declined';
  return 'Inquiry';
}

export function paymentOptionCopy(paymentMode) {
  if (paymentMode === 'direct') {
    return 'The seller is paid directly. Escrit cannot hold or recover the money, but reporting is available.';
  }
  return 'Payment uses Escrit escrow under the terms saved with this order. Escrow is not a guarantee of a particular outcome.';
}

export function canActOnOffer(offer, role, action) {
  const status = offer?.status;
  if (action === 'send-offer') return role === 'seller' && ['REQUESTED', 'CHANGES_REQUESTED'].includes(status);
  if (action === 'accept') {
    return (role === 'buyer' && ['QUOTED', 'COUNTERED'].includes(status))
      || (role === 'seller' && status === 'PROPOSED');
  }
  if (action === 'counter') return role === 'buyer' && status === 'QUOTED' && Number(offer?.counterCount || 0) === 0;
  if (action === 'decline') {
    return (role === 'buyer' && ['QUOTED', 'COUNTERED'].includes(status))
      || (role === 'seller' && ['REQUESTED', 'CHANGES_REQUESTED', 'PROPOSED'].includes(status));
  }
  return false;
}

export function friendlyChatError(error, fallback = 'We couldn’t complete that action. Please try again.') {
  const message = String(error?.message || '');
  if (/failed to fetch|network|request failed \(\d{3}\)/i.test(message)) {
    return 'We couldn’t reach Escrit just now. Check your connection and try again.';
  }
  return message || fallback;
}

export function chatNowUrl({ sellerId, listingId, listingType = 'service', title = '', sellerName = '' }) {
  const query = new URLSearchParams({
    sellerId: String(sellerId || ''),
    listingId: String(listingId || ''),
    listingType: String(listingType || 'service'),
  });
  if (title) query.set('title', title);
  if (sellerName) query.set('sellerName', sellerName);
  return `/account/chats?${query.toString()}`;
}

export function normalizeMessageId(message) {
  return String(message?.clientMessageId || message?._id || message?.id || '');
}

export function mergeMessages(current, incoming) {
  const indexed = new Map(current.map((message) => [normalizeMessageId(message), message]));
  for (const message of incoming) {
    const merged = { ...indexed.get(normalizeMessageId(message)), ...message };
    if (message.optimistic !== true) {
      merged.optimistic = false;
      merged.failed = false;
    }
    indexed.set(normalizeMessageId(message), merged);
  }
  return [...indexed.values()].sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
}
