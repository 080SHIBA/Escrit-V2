import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Service } from '../models/Service.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { ServiceOffer } from '../models/ServiceOffer.js';
import { ConversationMessage } from '../models/ConversationMessage.js';
import { User } from '../models/User.js';
import { quoteCollectionFee } from '../services/paymentProvider.js';
import { sendMessageNotificationEmail } from '../services/mailer.js';
import { env } from '../config/env.js';
import { effectivePaymentOptions } from './marketplace.js';

export const serviceOffersRouter = Router();
serviceOffersRouter.use(requireAuth);

function participant(offer, userId) {
  return String(offer.buyerId) === String(userId) || String(offer.sellerId) === String(userId);
}

export function serviceOfferActionAllowed(offer, userId, action) {
  const isBuyer = String(offer?.buyerId) === String(userId);
  const isSeller = String(offer?.sellerId) === String(userId);
  if (action === 'send-offer') return isSeller && ['REQUESTED', 'CHANGES_REQUESTED'].includes(offer.status);
  if (action === 'accept') return (isBuyer && ['QUOTED', 'COUNTERED'].includes(offer.status))
    || (isSeller && offer.status === 'PROPOSED');
  if (action === 'counter') return isBuyer && offer.status === 'QUOTED' && Number(offer.counterCount || 0) === 0;
  if (action === 'decline') return (isBuyer && ['QUOTED', 'COUNTERED'].includes(offer.status))
    || (isSeller && ['REQUESTED', 'CHANGES_REQUESTED', 'PROPOSED'].includes(offer.status));
  return false;
}

export function containsContactDetails(value) {
  const text = String(value || '');
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) return true;
  const candidates = text.match(/\+?\d[\d\s().-]{6,}\d/g) || [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  });
}

async function loadOffer(id, userId) {
  const offer = await ServiceOffer.findById(id);
  if (!offer) throw new AppError(404, 'Service deal not found');
  if (!participant(offer, userId)) throw new AppError(403, 'This service deal belongs to another account');
  return offer;
}

function emitToOffer(req, offer, event, payload) {
  req.app.get('io')?.to(`offer:${offer.id}`).emit(event, payload);
}

function emitOfferUpdate(req, offer) {
  emitToOffer(req, offer, 'conversation:offer', offer.toObject());
}

async function notifyRecipient(req, offer, recipientId, message) {
  const io = req.app.get('io');
  io?.to(`user:${recipientId}`).emit('notification:new', { messageId: message.id, offerId: offer.id });
  try {
    const [recipient, sender, service] = await Promise.all([
      User.findById(recipientId).select('email'),
      User.findById(message.senderId).select('businessName displayName'),
      Service.findById(offer.serviceId).select('title'),
    ]);
    if (!recipient?.email) return;
    const messageText = message.type === 'offer'
      ? `A service proposal was ${message.offerEvent?.action || 'updated'}.`
      : message.body;
    await sendMessageNotificationEmail(recipient.email, {
      senderName: sender?.displayName || sender?.businessName || 'An Escrit user',
      serviceName: service?.title || 'your service conversation',
      messageText,
      conversationUrl: new URL(`/account/chats?conversationId=${encodeURIComponent(offer.id)}`, env.clientUrl).toString(),
    });
  } catch (error) {
    console.error(`[notifications] Failed to email recipient about message ${message.id}:`, error.message);
  }
}

async function saveOfferMessage(req, offer, action, priceKobo, note = '') {
  const actorId = req.sellerId;
  const recipientId = String(actorId) === String(offer.buyerId) ? offer.sellerId : offer.buyerId;
  const message = await ConversationMessage.create({
    offerId: offer._id,
    senderId: actorId,
    recipientId,
    type: 'offer',
    offerEvent: { action, priceKobo, note, criteria: offer.fulfilmentCriteria, appointmentAt: offer.appointmentAt },
  });
  emitOfferUpdate(req, offer);
  emitToOffer(req, offer, 'conversation:message', message.toObject());
  await notifyRecipient(req, offer, recipientId, message);
  return message;
}

export const createSchema = Joi.object({
  serviceId: Joi.string().hex().length(24).required(),
  priceNaira: Joi.number().min(100).max(100000000).optional(),
  fulfilmentCriteria: Joi.string().trim().min(5).max(5000).required(),
  budgetNaira: Joi.number().min(0).max(100000000).allow(null).default(null),
  deadline: Joi.date().iso().allow(null).default(null),
  location: Joi.string().trim().max(500).allow('').default(''),
  attachments: Joi.array().items(Joi.string().uri({ scheme: ['https'] }).max(1000)).max(10).default([]),
  appointmentAt: Joi.date().iso().allow(null).default(null),
  paymentMode: Joi.string().valid('escrow', 'direct').optional(),
  directPaymentRiskAccepted: Joi.boolean().when('paymentMode', {
    is: 'direct',
    then: Joi.valid(true).required(),
    otherwise: Joi.valid(false).default(false),
  }),
  termsAccepted: Joi.boolean().valid(true).required(),
});

serviceOffersRouter.get('/', asyncHandler(async (req, res) => {
  const role = req.query.role || 'all';
  if (!['all', 'buyer', 'seller'].includes(role)) throw new AppError(400, 'Choose buyer or seller conversations.');
  const participantQuery = role === 'buyer'
    ? { buyerId: req.sellerId }
    : role === 'seller'
      ? { sellerId: req.sellerId }
      : { $or: [{ buyerId: req.sellerId }, { sellerId: req.sellerId }] };
  const offers = await ServiceOffer.find(participantQuery)
    .sort({ updatedAt: -1 })
    .populate('serviceId', 'title images basePrice startingPrice serviceModel paymentOptions')
    .populate('buyerId', 'businessName displayName profilePictureUrl kycStatus')
    .populate('sellerId', 'businessName displayName profilePictureUrl kycStatus');
  const offerIds = offers.map((offer) => offer._id);
  const [messageSummaries, unreadSummaries] = offerIds.length
    ? await Promise.all([
        ConversationMessage.aggregate([
          { $match: { offerId: { $in: offerIds } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$offerId', latestMessage: { $first: '$$ROOT' } } },
        ]),
        ConversationMessage.aggregate([
          { $match: { offerId: { $in: offerIds }, recipientId: new mongoose.Types.ObjectId(req.sellerId), readAt: null } },
          { $group: { _id: '$offerId', unreadCount: { $sum: 1 } } },
        ]),
      ])
    : [[], []];
  const latestByOffer = new Map(messageSummaries.map((entry) => [String(entry._id), entry.latestMessage]));
  const unreadByOffer = new Map(unreadSummaries.map((entry) => [String(entry._id), entry.unreadCount]));
  const acceptedOrderIds = offers.map((offer) => offer.acceptedOrderId).filter(Boolean);
  const orders = acceptedOrderIds.length
    ? await ServiceOrder.find({ _id: { $in: acceptedOrderIds } }).select('status paymentStatus paymentMode amountKobo termsSnapshot deliverables deliveryNote deliveredAt updatedAt')
    : [];
  const orderById = new Map(orders.map((order) => [String(order._id), order]));
  res.json({
    offers: offers.map((offer) => ({
      ...offer.toObject(),
      latestMessage: latestByOffer.get(String(offer._id)) || null,
      unreadCount: unreadByOffer.get(String(offer._id)) || 0,
      order: orderById.get(String(offer.acceptedOrderId)) || null,
    })),
  });
}));

serviceOffersRouter.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const service = await Service.findOne({ _id: req.body.serviceId, isActive: true, isVerified: true });
  if (!service) throw new AppError(404, 'Service is no longer available');
  if (String(service.seller) === String(req.sellerId)) throw new AppError(409, 'You cannot make an offer on your own service');
  const seller = await User.findById(service.seller);
  const paymentOptions = effectivePaymentOptions(service, seller);
  if (req.body.paymentMode && !paymentOptions[req.body.paymentMode]) throw new AppError(409, 'That payment option is not available for this service.');
  if (req.body.paymentMode === 'direct' && !seller?.bankAccount) throw new AppError(409, 'This seller is not ready to receive direct payment.');
  if (req.body.deadline && new Date(req.body.deadline) <= new Date()) throw new AppError(422, 'Choose a future project deadline.');
  const conversationKey = `${service._id}:${req.sellerId}`;
  const existing = await ServiceOffer.findOne({ conversationKey });
  if (existing) return res.json({ offer: existing, created: false });
  const priceKobo = req.body.priceNaira == null ? null : Math.round(req.body.priceNaira * 100);
  let offer;
  try {
    offer = await ServiceOffer.create({
      serviceId: service._id,
      buyerId: req.sellerId,
      sellerId: service.seller,
      conversationKey,
      paymentOptionsSnapshot: paymentOptions,
      currentPriceKobo: priceKobo,
      paymentMode: req.body.paymentMode || (paymentOptions.escrow ? 'escrow' : 'direct'),
      directPaymentRiskAcceptedAt: req.body.directPaymentRiskAccepted ? new Date() : null,
      fulfilmentCriteria: req.body.fulfilmentCriteria,
      projectRequest: {
        description: req.body.fulfilmentCriteria,
        budgetKobo: req.body.budgetNaira == null ? null : Math.round(req.body.budgetNaira * 100),
        deadline: req.body.deadline,
        location: req.body.location,
        attachments: req.body.attachments,
      },
      appointmentAt: req.body.appointmentAt,
      status: 'REQUESTED',
      offerHistory: [{ action: 'requested', actorId: req.sellerId, note: req.body.fulfilmentCriteria }],
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    offer = await ServiceOffer.findOne({ conversationKey });
    if (!offer) throw error;
    return res.json({ offer, created: false });
  }
  await saveOfferMessage(req, offer, 'requested', null);
  res.status(201).json({ offer });
}));

serviceOffersRouter.get('/:id/messages', asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  await offer.populate([
    { path: 'serviceId', select: 'title images basePrice startingPrice serviceModel paymentOptions' },
    { path: 'buyerId', select: 'businessName displayName profilePictureUrl kycStatus' },
    { path: 'sellerId', select: 'businessName displayName profilePictureUrl kycStatus' },
  ]);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
  const before = req.query.before;
  if (before && !mongoose.Types.ObjectId.isValid(before)) throw new AppError(400, 'That message cursor is invalid.');
  const now = new Date();
  await ConversationMessage.updateMany(
    { offerId: offer._id, recipientId: req.sellerId, readAt: null },
    { $set: { deliveredAt: now, readAt: now } }
  );
  const messageQuery = { offerId: offer._id };
  if (before) messageQuery._id = { $lt: new mongoose.Types.ObjectId(before) };
  const page = await ConversationMessage.find(messageQuery).sort({ _id: -1 }).limit(limit + 1);
  const hasMore = page.length > limit;
  const messages = page.slice(0, limit).reverse();
  const order = offer.acceptedOrderId ? await ServiceOrder.findById(offer.acceptedOrderId)
    .select('status paymentStatus paymentMode amountKobo termsSnapshot deliverables deliveryNote deliveredAt updatedAt') : null;
  req.app.get('io')?.to(`user:${req.sellerId}`).emit('notification:read');
  emitToOffer(req, offer, 'conversation:read', { readerId: req.sellerId, readAt: now });
  res.json({ messages, offer, order, hasMore, nextCursor: hasMore ? String(messages[0]?._id || '') : null });
}));

const messageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
  clientMessageId: Joi.string().trim().min(1).max(128).optional(),
});
serviceOffersRouter.post('/:id/messages', validate(messageSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  if (containsContactDetails(req.body.body)) {
    throw new AppError(422, 'For your safety, keep email addresses and phone numbers out of chat.');
  }
  if (req.body.clientMessageId) {
    const previous = await ConversationMessage.findOne({
      offerId: offer._id,
      senderId: req.sellerId,
      clientMessageId: req.body.clientMessageId,
    });
    if (previous) return res.json({ message: previous, duplicate: true });
  }
  const recipientId = String(req.sellerId) === String(offer.buyerId) ? offer.sellerId : offer.buyerId;
  const io = req.app.get('io');
  const recipientOnline = Boolean(io?.sockets.adapter.rooms.get(`user:${recipientId}`)?.size);
  const message = await ConversationMessage.create({
    offerId: offer._id,
    senderId: req.sellerId,
    recipientId,
    clientMessageId: req.body.clientMessageId || null,
    body: req.body.body,
    deliveredAt: recipientOnline ? new Date() : null,
  });
  emitToOffer(req, offer, 'conversation:message', message.toObject());
  await notifyRecipient(req, offer, recipientId, message);
  res.status(201).json({ message });
}));

const counterSchema = Joi.object({
  priceNaira: Joi.number().min(100).max(100000000).required(),
  note: Joi.string().trim().max(500).allow('').default(''),
});

const quoteSchema = Joi.object({
  scope: Joi.string().trim().min(5).max(5000).required(),
  deliverables: Joi.array().items(Joi.string().trim().min(1).max(240)).max(30).default([]),
  priceNaira: Joi.number().min(100).max(100000000).required(),
  timeline: Joi.string().trim().min(1).max(500).required(),
  deadline: Joi.date().iso().allow(null).default(null),
  revisionLimit: Joi.number().integer().min(0).max(20).default(0),
  milestones: Joi.array().items(Joi.object({
    title: Joi.string().trim().min(1).max(120).required(),
    amountNaira: Joi.number().min(0).max(100000000).required(),
  })).max(20).default([]),
  paymentTerms: Joi.string().trim().max(2000).allow('').default(''),
  paymentMode: Joi.string().valid('escrow', 'direct').optional(),
});

serviceOffersRouter.post('/:id/quote', validate(quoteSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  const expiredQuote = offer.status === 'QUOTED' && offer.quoteSnapshot?.expiresAt && offer.quoteSnapshot.expiresAt <= new Date();
  if (String(offer.sellerId) !== String(req.sellerId) || (!['REQUESTED', 'CHANGES_REQUESTED'].includes(offer.status) && !expiredQuote)) {
    throw new AppError(409, 'This project request is no longer waiting for a provider quote.');
  }
  if ([req.body.scope, req.body.timeline, req.body.paymentTerms, ...req.body.deliverables].some(containsContactDetails)) {
    throw new AppError(422, 'Keep email addresses and phone numbers out of offer details.');
  }
  const respondingToChanges = offer.status === 'CHANGES_REQUESTED';
  const service = await Service.findOne({ _id: offer.serviceId, isActive: true });
  if (!service) throw new AppError(409, 'This service is no longer available.');
  const seller = await User.findById(offer.sellerId);
  const paymentOptions = effectivePaymentOptions(service, seller);
  const paymentMode = req.body.paymentMode || (paymentOptions.escrow ? 'escrow' : 'direct');
  if (!paymentOptions[paymentMode]) throw new AppError(409, 'That payment method is not available for this service.');
  if (paymentMode === 'direct' && !seller?.bankAccount) throw new AppError(409, 'This provider is not ready to receive direct payment.');
  if (req.body.deadline && new Date(req.body.deadline) <= new Date()) throw new AppError(422, 'Choose a future project deadline.');
  const totalMilestoneKobo = req.body.milestones.reduce((sum, item) => sum + Math.round(item.amountNaira * 100), 0);
  if (req.body.milestones.length && totalMilestoneKobo !== Math.round(req.body.priceNaira * 100)) {
    throw new AppError(422, 'Milestone amounts must add up to the quoted price.');
  }
  const quoteSnapshot = {
    scope: req.body.scope,
    deliverables: req.body.deliverables,
    amountKobo: Math.round(req.body.priceNaira * 100),
    currency: 'NGN',
    timeline: req.body.timeline,
    deadline: req.body.deadline,
    revisionLimit: req.body.revisionLimit,
    milestones: req.body.milestones.map((milestone) => ({ title: milestone.title, amountKobo: Math.round(milestone.amountNaira * 100) })),
    paymentTerms: req.body.paymentTerms,
    expiresAt: new Date(Date.now() + service.quoteExpiryDays * 86_400_000),
    sentAt: new Date(),
  };
  offer.quoteSnapshot = quoteSnapshot;
  offer.currentPriceKobo = quoteSnapshot.amountKobo;
  offer.paymentOptionsSnapshot = paymentOptions;
  offer.paymentMode = paymentMode;
  offer.directPaymentRiskAcceptedAt = null;
  if (respondingToChanges) {
    offer.changeRequest.status = 'accepted';
    offer.changeRequest.acceptedBy = req.sellerId;
    offer.changeRequest.acceptedAt = new Date();
  }
  offer.status = 'QUOTED';
  offer.offerHistory.push({ action: 'quoted', actorId: req.sellerId, priceKobo: offer.currentPriceKobo, note: quoteSnapshot.scope.slice(0, 500) });
  await offer.save();
  const message = await saveOfferMessage(req, offer, 'quoted', offer.currentPriceKobo, quoteSnapshot.scope.slice(0, 500));
  res.json({ offer, message });
}));

serviceOffersRouter.post('/:id/counter', validate(counterSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  if (serviceOfferActionAllowed(offer, req.sellerId, 'counter')) {
    const priceKobo = Math.round(req.body.priceNaira * 100);
    offer.currentPriceKobo = priceKobo;
    offer.counterCount += 1;
    offer.status = 'PROPOSED';
    offer.offerHistory.push({ action: 'countered', actorId: req.sellerId, priceKobo, note: req.body.note });
    await offer.save();
    const message = await saveOfferMessage(req, offer, 'countered', priceKobo, req.body.note);
    return res.json({ offer, message });
  }
  if (String(offer.sellerId) !== String(req.sellerId) || offer.status !== 'PROPOSED' || offer.counterCount > 0) {
    throw new AppError(409, 'Only the seller can make one counter-offer to a new proposal');
  }
  const priceKobo = Math.round(req.body.priceNaira * 100);
  offer.currentPriceKobo = priceKobo;
  offer.counterCount += 1;
  offer.status = 'COUNTERED';
  offer.offerHistory.push({ action: 'countered', actorId: req.sellerId, priceKobo, note: req.body.note });
  await offer.save();
  const message = await saveOfferMessage(req, offer, 'countered', priceKobo, req.body.note);
  res.json({ offer, message });
}));

const acceptQuoteSchema = Joi.object({
  termsAccepted: Joi.boolean().valid(true).required(),
  paymentMode: Joi.string().valid('escrow', 'direct').optional(),
  directPaymentRiskAccepted: Joi.boolean().default(false),
});

serviceOffersRouter.post('/:id/accept', validate(acceptQuoteSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  if (offer.status === 'ACCEPTED' && String(offer.buyerId) === String(req.sellerId) && offer.acceptedOrderId) {
    const order = await ServiceOrder.findById(offer.acceptedOrderId)
      .select('status paymentStatus paymentMode amountKobo termsSnapshot deliverables deliveryNote deliveredAt updatedAt');
    return res.json({ offer, orderId: String(offer.acceptedOrderId), order });
  }
  const isSellerAccepting = offer.status === 'PROPOSED' && String(offer.sellerId) === String(req.sellerId);
  if (isSellerAccepting) {
    offer.status = 'QUOTED';
    offer.offerHistory.push({ action: 'quoted', actorId: req.sellerId, priceKobo: offer.currentPriceKobo });
    await offer.save();
    const message = await saveOfferMessage(req, offer, 'quoted', offer.currentPriceKobo, 'The provider accepted your counter-offer. Review the final offer.');
    return res.json({ offer, message, orderId: null, order: null });
  }
  const isBuyerAccepting = ['QUOTED', 'COUNTERED'].includes(offer.status)
    && String(offer.buyerId) === String(req.sellerId);
  if (!isBuyerAccepting || !serviceOfferActionAllowed(offer, req.sellerId, 'accept')) {
    throw new AppError(409, 'This offer is no longer awaiting your response.');
  }
  if (offer.quoteSnapshot?.expiresAt && offer.quoteSnapshot.expiresAt <= new Date()) {
    throw new AppError(409, 'This quote has expired. Ask the provider to send an updated quote.');
  }
  if (!Number.isFinite(offer.currentPriceKobo) || offer.currentPriceKobo < 10000) {
    throw new AppError(409, 'The provider has not sent a valid price yet.');
  }

  const service = await Service.findOne({ _id: offer.serviceId, isActive: true, isVerified: true });
  if (!service) throw new AppError(409, 'This service is no longer available.');
  const seller = await User.findById(offer.sellerId);
  const paymentOptions = offer.paymentOptionsSnapshot || effectivePaymentOptions(service, seller);
  const paymentMode = req.body.paymentMode || (paymentOptions.escrow ? 'escrow' : 'direct');
  if (!paymentOptions[paymentMode]) throw new AppError(409, 'That payment option is not available for this service.');
  if (paymentMode === 'direct' && !seller?.bankAccount) throw new AppError(409, 'This provider is not ready to receive direct payment.');
  const idempotencyKey = `service-offer:${offer.id}`;
  let order = offer.acceptedOrderId ? await ServiceOrder.findById(offer.acceptedOrderId) : null;
  if (!order) order = await ServiceOrder.findOne({ buyerId: offer.buyerId, idempotencyKey });
  const quote = offer.quoteSnapshot || {
    scope: offer.fulfilmentCriteria,
    deliverables: [],
    amountKobo: offer.currentPriceKobo,
    currency: 'NGN',
    timeline: '',
    deadline: null,
    revisionLimit: service.maxRevisions,
    milestones: [],
    paymentTerms: '',
    expiresAt: null,
    sentAt: null,
  };
  const termsSnapshot = [
    `Service: ${service.title}`,
    `Agreed scope: ${quote.scope || offer.fulfilmentCriteria}`,
    quote.deliverables?.length ? `Deliverables: ${quote.deliverables.join('; ')}` : '',
    `Agreed price: ₦${(offer.currentPriceKobo / 100).toLocaleString('en-NG')}`,
    quote.timeline ? `Timeline: ${quote.timeline}` : '',
    quote.deadline ? `Deadline: ${new Date(quote.deadline).toISOString()}` : '',
    quote.revisionLimit != null ? `Included revisions: ${quote.revisionLimit}` : '',
    quote.milestones?.length ? `Milestones: ${quote.milestones.map((item) => `${item.title} — ₦${(item.amountKobo / 100).toLocaleString('en-NG')}`).join('; ')}` : '',
    quote.paymentTerms ? `Payment terms: ${quote.paymentTerms}` : '',
    offer.projectRequest?.description ? `Buyer request: ${offer.projectRequest.description}` : '',
    offer.projectRequest?.location ? `Project location: ${offer.projectRequest.location}` : '',
    service.cancellationTerms ? `Cancellation: ${service.cancellationTerms}` : `Cancellation policy: ${service.cancellationPolicy}.`,
    'Payment option will be recorded before checkout.',
    'The accepted scope, price and terms are saved with this order.',
  ].filter(Boolean).join('\n\n');
  if (!order) {
    try {
      order = await ServiceOrder.create({
        serviceId: service._id,
        sellerId: offer.sellerId,
        buyerId: offer.buyerId,
        kind: 'quote',
        status: 'awaiting_payment',
        paymentMode,
        appointmentAt: offer.appointmentAt,
        durationMinutes: offer.appointmentAt ? service.durationMinutes : null,
        timeZone: service.timeZone,
        details: offer.fulfilmentCriteria,
        amountKobo: offer.currentPriceKobo,
        quoteSnapshot: { ...quote, amountKobo: offer.currentPriceKobo },
        termsSnapshot,
        termsAcceptedAt: new Date(),
        directPaymentRiskAcceptedAt: null,
        idempotencyKey,
        maxRevisions: quote.revisionLimit ?? service.maxRevisions,
        events: [{ status: 'awaiting_payment', actorId: req.sellerId, note: 'Service offer accepted. Awaiting verified payment.' }],
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      order = await ServiceOrder.findOne({ buyerId: offer.buyerId, idempotencyKey });
      if (!order) throw error;
    }
  }
  offer.paymentMode = paymentMode;
  offer.directPaymentRiskAcceptedAt = null;
  offer.status = 'ACCEPTED';
  offer.agreedPriceKobo = offer.currentPriceKobo;
  offer.acceptedOrderId = order._id;
  offer.offerHistory.push({ action: 'accepted', actorId: req.sellerId, priceKobo: offer.agreedPriceKobo });
  await offer.save();
  await saveOfferMessage(req, offer, 'accepted', offer.agreedPriceKobo);
  res.json({
    offer,
    orderId: order.id,
    order: await ServiceOrder.findById(order._id)
      .select('status paymentStatus paymentMode amountKobo termsSnapshot deliverables deliveryNote deliveredAt updatedAt'),
  });
}));

const paymentOptionSchema = Joi.object({
  paymentMode: Joi.string().valid('escrow', 'direct').required(),
  directPaymentRiskAccepted: Joi.boolean().when('paymentMode', {
    is: 'direct',
    then: Joi.valid(true).required(),
    otherwise: Joi.valid(false).default(false),
  }),
});

serviceOffersRouter.post('/:id/payment-option', validate(paymentOptionSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  if (String(offer.buyerId) !== String(req.sellerId) || offer.status !== 'ACCEPTED' || !offer.acceptedOrderId) {
    throw new AppError(403, 'Only the buyer can select the payment option for this accepted offer.');
  }
  const order = await ServiceOrder.findById(offer.acceptedOrderId);
  if (!order) throw new AppError(404, 'The service order could not be found.');
  if (order.paymentStatus !== 'unpaid' || order.transactionId || order.status !== 'awaiting_payment') {
    throw new AppError(409, 'The payment option can no longer be changed for this order.');
  }
  if (!offer.paymentOptionsSnapshot?.[req.body.paymentMode]) {
    throw new AppError(409, 'That payment option is not available for this service.');
  }
  if (req.body.paymentMode === 'direct') {
    const seller = await User.findById(offer.sellerId).select('bankAccount');
    if (!seller?.bankAccount) throw new AppError(409, 'This provider is not ready to receive direct payment.');
  }
  const paymentTerm = req.body.paymentMode === 'escrow'
    ? 'Payment method: Escrit escrow. Payment and release follow the transaction terms.'
    : 'Payment method: direct payment without escrow. Escrit cannot hold or recover the money, and reporting is available.';
  const terms = String(order.termsSnapshot || '')
    .split('\n\n')
    .filter((line) => !line.startsWith('Payment option will be recorded') && !line.startsWith('Payment method:'))
    .concat(paymentTerm);
  if (req.body.paymentMode === 'direct') terms.push('The buyer acknowledged the direct-payment risk before checkout.');
  order.paymentMode = req.body.paymentMode;
  order.directPaymentRiskAcceptedAt = req.body.paymentMode === 'direct' ? new Date() : null;
  order.termsSnapshot = terms.join('\n\n');
  await order.save();
  offer.paymentMode = req.body.paymentMode;
  offer.directPaymentRiskAcceptedAt = order.directPaymentRiskAcceptedAt;
  await offer.save();
  emitToOffer(req, offer, 'conversation:order', order.toObject());
  emitOfferUpdate(req, offer);
  res.json({ offer, order });
}));

const reportSchema = Joi.object({ reason: Joi.string().trim().min(5).max(1000).required() });
serviceOffersRouter.post('/:id/report', validate(reportSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  const reportedUserId = String(offer.buyerId) === String(req.sellerId) ? offer.sellerId : offer.buyerId;
  offer.conversationReports.push({
    reporterId: req.sellerId,
    reportedUserId,
    reason: req.body.reason,
  });
  await offer.save();
  res.status(201).json({ submitted: true });
}));

serviceOffersRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  const recipientId = ['PROPOSED', 'REQUESTED'].includes(offer.status) ? offer.sellerId : offer.buyerId;
  if (String(recipientId) !== String(req.sellerId) || !['PROPOSED', 'COUNTERED', 'REQUESTED', 'QUOTED', 'CHANGES_REQUESTED'].includes(offer.status)) {
    throw new AppError(409, 'This offer cannot be rejected by your account');
  }
  offer.status = 'REJECTED';
  offer.offerHistory.push({ action: 'rejected', actorId: req.sellerId, priceKobo: offer.currentPriceKobo });
  await offer.save();
  await saveOfferMessage(req, offer, 'rejected', offer.currentPriceKobo);
  res.json({ offer });
}));

serviceOffersRouter.post('/:id/decline', asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  if (!serviceOfferActionAllowed(offer, req.sellerId, 'decline')) {
    throw new AppError(403, 'This offer cannot be declined by your account.');
  }
  offer.status = 'REJECTED';
  offer.offerHistory.push({ action: 'rejected', actorId: req.sellerId, priceKobo: offer.currentPriceKobo });
  await offer.save();
  await saveOfferMessage(req, offer, 'rejected', offer.currentPriceKobo);
  res.json({ offer });
}));

const quoteChangeSchema = Joi.object({ note: Joi.string().trim().min(5).max(1000).required() });
serviceOffersRouter.post('/:id/request-changes', validate(quoteChangeSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  if (String(offer.buyerId) !== String(req.sellerId) || offer.status !== 'QUOTED') {
    throw new AppError(409, 'Only the buyer can request changes to an open quote.');
  }
  if (offer.quoteSnapshot?.expiresAt && offer.quoteSnapshot.expiresAt <= new Date()) {
    throw new AppError(409, 'This quote has expired. Ask the provider to send a new quote instead.');
  }
  offer.status = 'CHANGES_REQUESTED';
  offer.changeRequest = {
    note: req.body.note,
    requestedBy: req.sellerId,
    status: 'requested',
    acceptedBy: null,
    requestedAt: new Date(),
    acceptedAt: null,
  };
  offer.offerHistory.push({ action: 'changes_requested', actorId: req.sellerId, note: req.body.note });
  await offer.save();
  const message = await saveOfferMessage(req, offer, 'changes_requested', offer.currentPriceKobo, req.body.note);
  res.json({ offer, message });
}));
