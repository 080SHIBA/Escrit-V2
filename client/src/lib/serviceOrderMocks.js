const delay = () => new Promise((resolve) => setTimeout(resolve, 80));
const orders = new Map();
const byIdempotencyKey = new Map();
const offers = new Map();
const offerMessages = new Map();

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
    if (!['escrow', 'direct'].includes(payload.paymentMode)) throw new Error('Choose a payment method.');
    if (!Number.isFinite(Number(payload.priceNaira)) || Number(payload.priceNaira) < 100) throw new Error('Enter a valid service proposal amount.');
    if (!payload.fulfilmentCriteria?.trim() || payload.fulfilmentCriteria.trim().length < 5 || payload.fulfilmentCriteria.length > 2000) {
      throw new Error('Describe the agreed service scope.');
    }
    if (payload.paymentMode === 'direct' && payload.directPaymentRiskAccepted !== true) {
      throw new Error('Acknowledge the risks of paying the provider directly before continuing.');
    }
    const offer = {
      _id: `mock-service-offer-${offers.size + 1}`,
      serviceId: { _id: payload.serviceId, title: 'Mock service listing' },
      buyerId: { _id: 'mock-buyer', displayName: 'Local buyer' },
      sellerId: { _id: 'mock-seller', displayName: 'Local provider' },
      status: 'PROPOSED',
      currentPriceKobo: Math.round(Number(payload.priceNaira) * 100),
      agreedPriceKobo: null,
      paymentMode: payload.paymentMode,
      directPaymentRiskAcceptedAt: payload.directPaymentRiskAccepted ? new Date().toISOString() : null,
      fulfilmentCriteria: payload.fulfilmentCriteria,
      appointmentAt: payload.appointmentAt || null,
      counterCount: 0,
      acceptedOrderId: null,
      createdAt: new Date().toISOString(),
    };
    const message = {
      _id: `mock-offer-message-${Date.now()}-${offers.size}`,
      offerId: offer._id,
      senderId: 'mock-buyer',
      type: 'offer',
      offerEvent: { action: 'proposed', priceKobo: offer.currentPriceKobo, criteria: offer.fulfilmentCriteria, appointmentAt: offer.appointmentAt },
      createdAt: new Date().toISOString(),
    };
    offers.set(offer._id, offer);
    offerMessages.set(offer._id, [message]);
    return { offer: { ...offer } };
  },
  async listOffers() {
    await delay();
    return { offers: [...offers.values()].map((offer) => ({ ...offer, latestMessage: offerMessages.get(offer._id)?.at(-1) || null })) };
  },
  async getOfferMessages(id) {
    await delay();
    const offer = offers.get(id);
    if (!offer) throw new Error('Service proposal not found.');
    return { offer: { ...offer }, messages: [...(offerMessages.get(id) || [])] };
  },
  async sendOfferMessage(id, body) {
    await delay();
    const offer = offers.get(id);
    if (!offer) throw new Error('Service proposal not found.');
    if (!body.trim()) throw new Error('Enter a message before sending.');
    const message = { _id: `mock-offer-message-${Date.now()}-${(offerMessages.get(id) || []).length}`, offerId: id, senderId: 'mock-buyer', type: 'text', body: body.trim(), createdAt: new Date().toISOString() };
    offerMessages.get(id).push(message);
    return { message };
  },
  async counterOffer(id, payload) {
    await delay();
    const offer = offers.get(id);
    if (!offer || offer.status !== 'PROPOSED' || offer.counterCount > 0) throw new Error('This proposal cannot be countered.');
    offer.status = 'COUNTERED';
    offer.counterCount = 1;
    offer.currentPriceKobo = Math.round(Number(payload.priceNaira) * 100);
    const message = { _id: `mock-offer-message-${Date.now()}-counter`, offerId: id, senderId: 'mock-seller', type: 'offer', offerEvent: { action: 'countered', priceKobo: offer.currentPriceKobo, note: payload.note || '' }, createdAt: new Date().toISOString() };
    offerMessages.get(id).push(message);
    return { offer: { ...offer }, message };
  },
  async acceptOffer(id) {
    await delay();
    const offer = offers.get(id);
    if (!offer || offer.status !== 'COUNTERED') throw new Error('This proposal is not ready for buyer acceptance.');
    offer.status = 'ACCEPTED';
    offer.agreedPriceKobo = offer.currentPriceKobo;
    const order = {
      _id: `mock-service-order-${orders.size + 1}`,
      serviceId: offer.serviceId,
      buyerId: 'mock-buyer',
      sellerId: 'mock-seller',
      kind: 'quote',
      status: 'awaiting_payment',
      paymentStatus: 'unpaid',
      paymentMode: offer.paymentMode,
      amountKobo: offer.agreedPriceKobo,
      termsSnapshot: `Mock agreed scope: ${offer.fulfilmentCriteria}\n\n${offer.paymentMode === 'escrow'
        ? 'Escrit escrow was selected. The mock has not processed payment.'
        : 'Direct payment goes to the provider. Escrit cannot hold or recover it, and reporting does not guarantee a refund.'}`,
      termsAcceptedAt: new Date().toISOString(),
      directPaymentRiskAcceptedAt: offer.directPaymentRiskAcceptedAt,
      events: [],
    };
    orders.set(order._id, order);
    offer.acceptedOrderId = order._id;
    offer.offerHistory = [{ action: 'accepted', priceKobo: offer.agreedPriceKobo, actorId: 'mock-buyer' }];
    const message = { _id: `mock-offer-message-${Date.now()}-accepted`, offerId: id, senderId: 'mock-buyer', type: 'offer', offerEvent: { action: 'accepted', priceKobo: offer.agreedPriceKobo }, createdAt: new Date().toISOString() };
    offerMessages.get(id).push(message);
    return { offer: { ...offer }, orderId: order._id };
  },
  async rejectOffer(id) {
    await delay();
    const offer = offers.get(id);
    if (!offer || offer.status === 'ACCEPTED' || offer.status === 'REJECTED') throw new Error('This proposal cannot be rejected.');
    offer.status = 'REJECTED';
    const message = { _id: `mock-offer-message-${Date.now()}-rejected`, offerId: id, senderId: 'mock-buyer', type: 'offer', offerEvent: { action: 'rejected', priceKobo: offer.currentPriceKobo }, createdAt: new Date().toISOString() };
    offerMessages.get(id).push(message);
    return { offer: { ...offer } };
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
    const transitions = {
      confirm: 'awaiting_payment',
      decline: 'declined',
      cancel: 'cancelled',
      start: 'in_progress',
      deliver: 'delivered',
      revision: 'revision_requested',
      accept: 'completed',
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
    order.status = transitions[action];
    order.events.push({ status: order.status, createdAt: new Date().toISOString() });
    return { order: { ...order } };
  },
};
