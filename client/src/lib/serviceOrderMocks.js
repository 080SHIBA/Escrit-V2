const delay = () => new Promise((resolve) => setTimeout(resolve, 80));
const orders = new Map();
const byIdempotencyKey = new Map();
const offers = new Map();
const offerMessages = new Map();
const deliveryFiles = new Map();
const conversationReports = [];

export const serviceOrderMocksEnabled = Boolean(import.meta.env?.DEV)
  && import.meta.env?.VITE_MARKETPLACE_MOCK !== 'false'
  && import.meta.env?.VITE_SERVICE_ORDER_MOCK !== 'false';

export const serviceOrderMockHandlers = {
  async availability(serviceId, date) {
    await delay();
    if (!serviceId.startsWith('mock-listing-')) throw new Error('Service is no longer available.');
    const [year, month, day] = date.split('-').map(Number);
    return {
      date,
      timeZone: 'Africa/Lagos',
      slots: ['09:00', '10:30', '13:00'].map((time) => {
        const [hour, minute] = time.split(':').map(Number);
        return new Date(Date.UTC(year, month - 1, day, hour - 1, minute)).toISOString();
      }),
    };
  },
  async create(serviceId, payload) {
    await delay();
    const existingId = byIdempotencyKey.get(payload.idempotencyKey);
    if (existingId) return { order: { ...orders.get(existingId) }, created: false };
    if (!payload.termsAccepted) throw new Error('Review the service terms before continuing.');
    if (!['escrow', 'direct'].includes(payload.paymentMode)) throw new Error('Choose a payment method.');
    if (payload.paymentMode === 'direct' && payload.directPaymentRiskAccepted !== true) {
      throw new Error('Acknowledge the risks of paying the provider directly before continuing.');
    }
    const order = {
      _id: `mock-service-order-${orders.size + 1}`,
      serviceId: { _id: serviceId, title: 'Mock service listing', serviceModel: payload.appointmentAt ? 'appointment' : 'fixed_scope' },
      buyerId: 'mock-buyer',
      sellerId: 'mock-seller',
      kind: payload.appointmentAt ? 'appointment' : 'fixed_scope',
      status: payload.appointmentAt ? 'pending_approval' : 'awaiting_payment',
      paymentStatus: 'unpaid',
      paymentMode: payload.paymentMode,
      appointmentAt: payload.appointmentAt,
      amountKobo: 12000000,
      termsSnapshot: payload.paymentMode === 'direct'
        ? 'Local mock terms. The buyer acknowledged that Escrit cannot hold or recover direct payment; reporting does not guarantee a refund. No payment has been taken.'
        : 'Local mock terms. Escrit escrow was selected. No payment has been taken.',
      termsAcceptedAt: new Date().toISOString(),
      directPaymentRiskAcceptedAt: payload.directPaymentRiskAccepted ? new Date().toISOString() : null,
      events: [],
    };
    orders.set(order._id, order);
    byIdempotencyKey.set(payload.idempotencyKey, order._id);
    return { order: { ...order }, created: true };
  },
  async checkout() {
    await delay();
    throw new Error('Payment is disabled in local service-order mock mode.');
  },
  async list() {
    await delay();
    return { orders: [...orders.values()].map((order) => ({ ...order })) };
  },
  async createOffer(payload) {
    await delay();
    if (!payload.termsAccepted) throw new Error('Review the service proposal terms before continuing.');
    if (!payload.fulfilmentCriteria?.trim() || payload.fulfilmentCriteria.trim().length < 5 || payload.fulfilmentCriteria.length > 5000) {
      throw new Error('Describe the agreed service scope.');
    }
    const offer = {
      _id: `mock-service-offer-${offers.size + 1}`,
      serviceId: {
        _id: payload.serviceId,
        title: payload.title || 'Mock service listing',
        serviceModel: payload.serviceModel || 'custom_quote',
        basePrice: Number(payload.basePrice || 0),
        paymentOptions: payload.paymentOptionsSnapshot || { escrow: true, direct: true },
      },
      buyerId: { _id: 'mock-buyer', displayName: 'Local buyer' },
      sellerId: { _id: payload.sellerId || 'mock-seller', displayName: payload.sellerName || 'Local provider', kycStatus: payload.sellerVerified ? 'verified' : 'pending' },
      status: 'REQUESTED',
      currentPriceKobo: null,
      agreedPriceKobo: null,
      paymentMode: payload.paymentOptionsSnapshot?.escrow === false ? 'direct' : 'escrow',
      paymentOptionsSnapshot: payload.paymentOptionsSnapshot || { escrow: true, direct: true },
      directPaymentRiskAcceptedAt: null,
      fulfilmentCriteria: payload.fulfilmentCriteria,
      projectRequest: {
        description: payload.fulfilmentCriteria,
        budgetKobo: payload.budgetNaira == null ? null : Math.round(Number(payload.budgetNaira) * 100),
        deadline: payload.deadline || null,
        location: payload.location || '',
        attachments: payload.attachments || [],
      },
      quoteSnapshot: null,
      changeRequest: { status: 'none' },
      counterCount: 0,
      acceptedOrderId: null,
      createdAt: new Date().toISOString(),
    };
    const message = {
      _id: `mock-offer-message-${Date.now()}-${offers.size}`,
      offerId: offer._id,
      senderId: 'mock-buyer',
      type: 'offer',
      offerEvent: { action: 'requested', priceKobo: null, criteria: offer.fulfilmentCriteria },
      createdAt: new Date().toISOString(),
    };
    offers.set(offer._id, offer);
    offerMessages.set(offer._id, [message]);
    return { offer: { ...offer } };
  },
  async openConversation(payload) {
    await delay();
    const existing = [...offers.values()].find((offer) => String(offer.serviceId?._id) === String(payload.serviceId));
    if (existing) return { offer: { ...existing }, created: false };
    return this.createOffer({
      ...payload,
      fulfilmentCriteria: payload.fulfilmentCriteria || 'I’d like to discuss this service in Escrit chat.',
      termsAccepted: true,
    });
  },
  async sendQuote(id, payload) {
    await delay();
    const offer = offers.get(id);
    if (payload.actorRole && payload.actorRole !== 'seller') throw new Error('Only the service provider can send an offer.');
    const expiredQuote = offer?.status === 'QUOTED' && offer.quoteSnapshot?.expiresAt && new Date(offer.quoteSnapshot.expiresAt) <= new Date();
    if (!offer || (!['REQUESTED', 'CHANGES_REQUESTED'].includes(offer.status) && !expiredQuote)) throw new Error('This project request is no longer waiting for a provider quote.');
    if (!payload.scope?.trim() || payload.scope.trim().length < 5) throw new Error('Describe the quote scope.');
    if (!Number.isFinite(Number(payload.priceNaira)) || Number(payload.priceNaira) < 100) throw new Error('Enter a valid quote price.');
    if (payload.paymentMode && !['escrow', 'direct'].includes(payload.paymentMode)) throw new Error('Choose a payment arrangement.');
    const milestoneTotal = (payload.milestones || []).reduce((sum, item) => sum + Math.round(Number(item.amountNaira) * 100), 0);
    if (payload.milestones?.length && milestoneTotal !== Math.round(Number(payload.priceNaira) * 100)) {
      throw new Error('Milestone amounts must add up to the quoted price.');
    }
    const previousChangeRequest = offer.status === 'CHANGES_REQUESTED' ? offer.changeRequest : null;
    offer.status = 'QUOTED';
    offer.paymentMode = payload.paymentMode || (offer.paymentOptionsSnapshot?.escrow ? 'escrow' : 'direct');
    offer.paymentOptionsSnapshot = offer.serviceId?.paymentOptions || offer.paymentOptionsSnapshot;
    offer.currentPriceKobo = Math.round(Number(payload.priceNaira) * 100);
    offer.directPaymentRiskAcceptedAt = null;
    offer.quoteSnapshot = {
      scope: payload.scope,
      deliverables: payload.deliverables || [],
      amountKobo: offer.currentPriceKobo,
      currency: 'NGN',
      timeline: payload.timeline,
      deadline: payload.deadline || null,
      revisionLimit: Number(payload.revisionLimit || 0),
      milestones: (payload.milestones || []).map((item) => ({ title: item.title, amountKobo: Math.round(Number(item.amountNaira) * 100) })),
      paymentTerms: payload.paymentTerms || '',
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      sentAt: new Date().toISOString(),
    };
    if (previousChangeRequest) offer.changeRequest = { ...previousChangeRequest, status: 'accepted', acceptedBy: 'mock-seller', acceptedAt: new Date().toISOString() };
    const message = {
      _id: `mock-offer-message-${Date.now()}-quoted`,
      offerId: id,
      senderId: 'mock-seller',
      type: 'offer',
      offerEvent: { action: 'quoted', priceKobo: offer.currentPriceKobo, note: payload.scope.slice(0, 500) },
      createdAt: new Date().toISOString(),
    };
    offerMessages.get(id).push(message);
    return { offer: { ...offer }, message };
  },
  async requestQuoteChanges(id, note) {
    await delay();
    const offer = offers.get(id);
    if (!offer || offer.status !== 'QUOTED' || !note?.trim() || note.trim().length < 5) {
      throw new Error('Only the buyer can request changes to an open quote.');
    }
    if (offer.quoteSnapshot?.expiresAt && new Date(offer.quoteSnapshot.expiresAt) <= new Date()) {
      throw new Error('This quote has expired. Ask the provider to send a new quote instead.');
    }
    offer.status = 'CHANGES_REQUESTED';
    offer.changeRequest = { note: note.trim(), requestedBy: 'mock-buyer', status: 'requested', requestedAt: new Date().toISOString() };
    const message = {
      _id: `mock-offer-message-${Date.now()}-changes`,
      offerId: id,
      senderId: 'mock-buyer',
      type: 'offer',
      offerEvent: { action: 'changes_requested', priceKobo: offer.currentPriceKobo, note: note.trim() },
      createdAt: new Date().toISOString(),
    };
    offerMessages.get(id).push(message);
    return { offer: { ...offer }, message };
  },
  async listOffers({ role } = {}) {
    await delay();
    const listedOffers = [...offers.values()].filter((offer) => !role || role === 'all' || ['buyer', 'seller'].includes(role));
    return { offers: listedOffers.map((offer) => ({ ...offer, latestMessage: offerMessages.get(offer._id)?.at(-1) || null })) };
  },
  async getOfferMessages(id, before) {
    await delay();
    const offer = offers.get(id);
    if (!offer) throw new Error('Service proposal not found.');
    const allMessages = offerMessages.get(id) || [];
    const cursorIndex = before ? allMessages.findIndex((message) => message._id === before) : allMessages.length;
    const end = cursorIndex < 0 ? allMessages.length : cursorIndex;
    const messages = allMessages.slice(Math.max(0, end - 30), end);
    return {
      offer: { ...offer },
      order: offer.acceptedOrderId ? { ...orders.get(offer.acceptedOrderId) } : null,
      messages,
      hasMore: end > messages.length,
      nextCursor: messages[0]?._id || null,
    };
  },
  async sendOfferMessage(id, body, clientMessageId, role = 'buyer') {
    await delay();
    const offer = offers.get(id);
    if (!offer) throw new Error('Service proposal not found.');
    if (!['buyer', 'seller'].includes(role)) throw new Error('Choose a valid conversation role.');
    if (!body.trim()) throw new Error('Enter a message before sending.');
    const priorMessage = clientMessageId && (offerMessages.get(id) || []).find((message) => message.clientMessageId === clientMessageId);
    if (priorMessage) return { message: priorMessage };
    const message = {
      _id: `mock-offer-message-${Date.now()}-${(offerMessages.get(id) || []).length}`,
      clientMessageId,
      offerId: id,
      senderId: role === 'seller' ? offer.sellerId._id : offer.buyerId._id,
      type: 'text',
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    offerMessages.get(id).push(message);
    return { message };
  },
  async counterOffer(id, payload) {
    await delay();
    const offer = offers.get(id);
    if (!offer || !['PROPOSED', 'QUOTED'].includes(offer.status) || offer.counterCount > 0) throw new Error('This proposal cannot be countered.');
    if (payload.actorRole && payload.actorRole !== 'buyer') throw new Error('Only the buyer can counter this offer.');
    if (!Number.isFinite(Number(payload.priceNaira)) || Number(payload.priceNaira) < 100) throw new Error('Enter a valid counter-offer price.');
    offer.status = 'COUNTERED';
    offer.counterCount = 1;
    offer.currentPriceKobo = Math.round(Number(payload.priceNaira) * 100);
    const message = { _id: `mock-offer-message-${Date.now()}-counter`, offerId: id, senderId: offer.buyerId._id, type: 'offer', offerEvent: { action: 'countered', priceKobo: offer.currentPriceKobo, note: payload.note || '' }, createdAt: new Date().toISOString() };
    offerMessages.get(id).push(message);
    return { offer: { ...offer }, message };
  },
  async acceptOffer(id, payload = {}) {
    await delay();
    const offer = offers.get(id);
    if (offer?.status === 'ACCEPTED' && offer.acceptedOrderId) return { offer: { ...offer }, orderId: offer.acceptedOrderId, order: { ...orders.get(offer.acceptedOrderId) } };
    if (offer?.status === 'PROPOSED' && payload.actorRole === 'seller') {
      offer.status = 'QUOTED';
      const message = { _id: `mock-offer-message-${Date.now()}-quoted`, offerId: id, senderId: offer.sellerId._id, type: 'offer', offerEvent: { action: 'quoted', priceKobo: offer.currentPriceKobo, note: 'The provider accepted your counter-offer.' }, createdAt: new Date().toISOString() };
      offerMessages.get(id).push(message);
      return { offer: { ...offer }, message, orderId: null, order: null };
    }
    if (payload.actorRole === 'seller') throw new Error('Only the buyer can accept this offer.');
    const acceptingQuote = offer?.status === 'QUOTED';
    if (!offer || (!acceptingQuote && offer.status !== 'COUNTERED')) throw new Error('This proposal is not ready for buyer acceptance.');
    if (acceptingQuote && payload.termsAccepted !== true) throw new Error('Review the quote terms before accepting.');
    if (acceptingQuote && offer.quoteSnapshot?.expiresAt && new Date(offer.quoteSnapshot.expiresAt) <= new Date()) {
      throw new Error('This quote has expired. Ask the provider to send an updated quote.');
    }
    const paymentMode = payload.paymentMode || (offer.paymentOptionsSnapshot?.escrow ? 'escrow' : 'direct');
    if (!offer.paymentOptionsSnapshot?.[paymentMode]) throw new Error('This payment option is not available for the listing.');
    if (paymentMode === 'direct' && payload.paymentMode === 'direct' && payload.directPaymentRiskAccepted !== true) {
      throw new Error('Acknowledge the risks of paying the provider directly before continuing.');
    }
    offer.status = 'ACCEPTED';
    offer.agreedPriceKobo = offer.currentPriceKobo;
    offer.paymentMode = paymentMode;
    const order = {
      _id: `mock-service-order-${orders.size + 1}`,
      serviceId: offer.serviceId,
      buyerId: offer.buyerId._id,
      sellerId: offer.sellerId._id,
      kind: 'quote',
      status: 'awaiting_payment',
      paymentStatus: 'unpaid',
      paymentMode,
      amountKobo: offer.agreedPriceKobo,
      currency: 'NGN',
      quoteSnapshot: offer.quoteSnapshot ? { ...offer.quoteSnapshot, milestones: [...offer.quoteSnapshot.milestones] } : null,
      termsSnapshot: `Mock agreed scope: ${offer.quoteSnapshot?.scope || offer.fulfilmentCriteria}\n\nPayment terms are saved before checkout.`,
      termsAcceptedAt: new Date().toISOString(),
      directPaymentRiskAcceptedAt: null,
      events: [],
    };
    orders.set(order._id, order);
    offer.acceptedOrderId = order._id;
    offer.offerHistory = [{ action: 'accepted', priceKobo: offer.agreedPriceKobo, actorId: 'mock-buyer' }];
    const message = { _id: `mock-offer-message-${Date.now()}-accepted`, offerId: id, senderId: offer.buyerId._id, type: 'offer', offerEvent: { action: 'accepted', priceKobo: offer.agreedPriceKobo }, createdAt: new Date().toISOString() };
    offerMessages.get(id).push(message);
    return { offer: { ...offer }, orderId: order._id, order: { ...order } };
  },
  async rejectOffer(id, role = 'buyer') {
    await delay();
    const offer = offers.get(id);
    const sellerCanDecline = role === 'seller' && ['REQUESTED', 'CHANGES_REQUESTED', 'PROPOSED'].includes(offer?.status);
    if (role !== 'buyer' && !sellerCanDecline) throw new Error('Only the buyer can decline this offer.');
    if (!offer || offer.status === 'ACCEPTED' || offer.status === 'REJECTED') throw new Error('This proposal cannot be rejected.');
    offer.status = 'REJECTED';
    const message = { _id: `mock-offer-message-${Date.now()}-rejected`, offerId: id, senderId: role === 'seller' ? offer.sellerId._id : offer.buyerId._id, type: 'offer', offerEvent: { action: 'rejected', priceKobo: offer.currentPriceKobo }, createdAt: new Date().toISOString() };
    offerMessages.get(id).push(message);
    return { offer: { ...offer } };
  },
  async setPaymentOption(id, payload = {}) {
    await delay();
    const offer = offers.get(id);
    const order = offer?.acceptedOrderId && orders.get(offer.acceptedOrderId);
    if (!offer || !order || offer.status !== 'ACCEPTED') throw new Error('Accept the offer before choosing a payment option.');
    if (payload.actorRole && payload.actorRole !== 'buyer') throw new Error('Only the buyer can choose the payment option.');
    if (order.paymentStatus === 'paid') throw new Error('The payment option cannot change after payment.');
    const paymentMode = payload.paymentMode;
    if (!['escrow', 'direct'].includes(paymentMode) || offer.paymentOptionsSnapshot?.[paymentMode] !== true) {
      throw new Error('This payment option is not available for the listing.');
    }
    if (paymentMode === 'direct' && payload.directPaymentRiskAccepted !== true) {
      throw new Error('Acknowledge the risks of paying the provider directly before continuing.');
    }
    order.paymentMode = paymentMode;
    offer.paymentMode = paymentMode;
    if (paymentMode === 'direct') {
      order.directPaymentRiskAcceptedAt = new Date().toISOString();
      offer.directPaymentRiskAcceptedAt = order.directPaymentRiskAcceptedAt;
    } else {
      order.directPaymentRiskAcceptedAt = null;
      offer.directPaymentRiskAcceptedAt = null;
    }
    order.termsSnapshot = `Mock agreed scope: ${offer.quoteSnapshot?.scope || offer.fulfilmentCriteria}\n\n${paymentMode === 'escrow'
      ? 'Escrit escrow was selected. Payment remains subject to provider confirmation.'
      : 'Direct payment goes to the provider. Escrit cannot hold or recover it, and reporting does not guarantee a refund.'}`;
    return { offer: { ...offer }, order: { ...order } };
  },
  async verifyPayment(id, payload = {}) {
    await delay();
    const order = orders.get(id);
    if (!order) throw new Error('Service order not found.');
    if (order.paymentStatus === 'paid' && order.providerTransactionId === payload.transactionId) return { order: { ...order }, created: false };
    if (!payload.transactionId || payload.status !== 'success' || payload.currency !== order.currency || Number(payload.amountKobo) !== Number(order.amountKobo)) {
      throw new Error('Payment could not be verified.');
    }
    if (order.paymentStatus === 'paid') throw new Error('This order already has a confirmed payment.');
    order.paymentStatus = 'paid';
    order.status = 'ready_to_start';
    order.providerTransactionId = payload.transactionId;
    order.paymentConfirmedAt = new Date().toISOString();
    order.events.push({ status: 'payment_confirmed', createdAt: order.paymentConfirmedAt });
    return { order: { ...order }, created: true };
  },
  async confirmMockPayment(id, result = 'success') {
    await delay();
    const order = orders.get(id);
    if (!order) throw new Error('Service order not found.');
    if (result !== 'success') throw new Error('We could not confirm your payment yet. Check your orders before trying again.');
    return this.verifyPayment(id, {
      transactionId: order.providerTransactionId || `mock-payment-${id}`,
      status: 'success',
      currency: order.currency,
      amountKobo: order.amountKobo,
    });
  },
  async reportConversation(id, payload = {}) {
    await delay();
    if (!offers.has(id)) throw new Error('Conversation not found.');
    if (!payload.reason?.trim()) throw new Error('Choose a reason for reporting this conversation.');
    const report = { id: `mock-report-${conversationReports.length + 1}`, offerId: id, reason: payload.reason.trim(), createdAt: new Date().toISOString() };
    conversationReports.push(report);
    return { report: { ...report } };
  },
  async uploadDeliveryFile(id, file, role = 'seller') {
    await delay();
    const order = orders.get(id);
    if (!order) throw new Error('Service order not found.');
    if (role !== 'seller') throw new Error('Only the provider can share delivery files.');
    if (order.status !== 'in_progress' || order.paymentStatus !== 'paid') throw new Error('Delivery files are available after payment is confirmed.');
    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/zip']);
    if (!file || !allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error('Choose a supported delivery file under 10 MB.');
    }
    const assetId = `mock-delivery-${deliveryFiles.size + 1}`;
    deliveryFiles.set(assetId, { orderId: id, file });
    return { assetId, name: file.name, size: file.size, mimeType: file.type };
  },
  async getDeliveryFile(id, assetId, role = 'buyer') {
    await delay();
    const item = deliveryFiles.get(assetId);
    const order = orders.get(id);
    if (!item || item.orderId !== id || !order || !['buyer', 'seller'].includes(role)) {
      throw new Error('This delivery file is not available for this order.');
    }
    if (!['delivered', 'completed', 'disputed'].includes(order.status)) throw new Error('The provider has not shared this delivery yet.');
    return { url: `mock://delivery/${encodeURIComponent(assetId)}`, name: item.file.name };
  },
  async message(id, message) {
    await delay();
    const order = orders.get(id);
    if (!order) throw new Error('Service order not found.');
    if (!message.trim()) throw new Error('Enter a message before sending.');
    order.events.push({ status: 'message', actorId: 'mock-buyer', note: message.trim(), createdAt: new Date().toISOString() });
    return { order: { ...order } };
  },
  async update(id, action, payload = {}) {
    await delay();
    const order = orders.get(id);
    if (!order) throw new Error('Service order not found.');
    const sellerActions = new Set(['start', 'deliver', 'reschedule-confirm']);
    const buyerActions = new Set(['accept', 'revision', 'dispute', 'reschedule-request']);
    const role = payload.actorRole || (sellerActions.has(action) ? 'seller' : 'buyer');
    if ((sellerActions.has(action) && role !== 'seller') || (buyerActions.has(action) && role !== 'buyer')) {
      throw new Error(`Only the ${sellerActions.has(action) ? 'provider' : 'buyer'} can perform this action.`);
    }
    const transitions = {
      confirm: 'awaiting_payment',
      decline: 'declined',
      cancel: 'cancelled',
      start: 'in_progress',
      deliver: 'delivered',
      revision: 'revision_requested',
      accept: 'completed',
      dispute: 'disputed',
    };
    if (action === 'reschedule-request') {
      if (!payload.appointmentAt || !order.appointmentAt) throw new Error('Choose a new time for this appointment.');
      order.requestedAppointmentAt = payload.appointmentAt;
      order.events.push({ status: 'reschedule_requested', actorId: 'mock-buyer', note: `Requested appointment change to ${payload.appointmentAt}.`, createdAt: new Date().toISOString() });
      return { order: { ...order } };
    }
    if (action === 'reschedule-confirm') {
      if (!order.requestedAppointmentAt) throw new Error('There is no rescheduling request to confirm.');
      order.appointmentAt = order.requestedAppointmentAt;
      order.requestedAppointmentAt = null;
      order.events.push({ status: 'rescheduled', actorId: 'mock-seller', note: `Provider confirmed new appointment time ${order.appointmentAt}.`, createdAt: new Date().toISOString() });
      return { order: { ...order } };
    }
    if (!transitions[action]) throw new Error('That service-order action is not supported.');
    if (action === 'start' && (!['ready_to_start', 'confirmed'].includes(order.status) || order.paymentStatus !== 'paid')) {
      throw new Error('This order is not ready to start.');
    }
    if (action === 'deliver' && (order.status !== 'in_progress' || order.paymentStatus !== 'paid')) {
      throw new Error('Delivery can be shared after payment is confirmed and work is in progress.');
    }
    if (action === 'accept' && order.status !== 'delivered') throw new Error('Confirm completion after the provider shares delivery.');
    if (action === 'dispute') {
      if (!payload.reason?.trim() || payload.reason.trim().length < 5) throw new Error('Add a short reason so Escrit can review the dispute.');
      if (order.paymentMode === 'direct' || order.paymentStatus !== 'paid') throw new Error('Only a paid escrow order can be disputed. Direct payments cannot be held or recovered by Escrit.');
    }
    order.status = transitions[action];
    if (action === 'deliver') {
      order.deliveryNote = payload.note?.trim() || '';
      order.deliverables = (payload.deliverables || []).map((item) => ({ ...item }));
    }
    if (action === 'accept' && order.paymentMode === 'escrow') order.paymentStatus = 'released';
    order.events.push({ status: order.status, actorId: role === 'seller' ? order.sellerId : order.buyerId, note: payload.reason || payload.note || '', createdAt: new Date().toISOString() });
    return { order: { ...order } };
  },
};
