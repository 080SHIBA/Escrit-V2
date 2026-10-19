import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Service } from '../models/Service.js';
import { ServiceOffer } from '../models/ServiceOffer.js';
import { ConversationMessage } from '../models/ConversationMessage.js';
import { Link } from '../models/Link.js';
import { User } from '../models/User.js';
import { quoteCollectionFee } from '../services/paymentProvider.js';
import { sendMessageNotificationEmail } from '../services/mailer.js';
import { env } from '../config/env.js';

export const serviceOffersRouter = Router();
serviceOffersRouter.use(requireAuth);

function participant(offer, userId) {
  return String(offer.buyerId) === String(userId) || String(offer.sellerId) === String(userId);
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

async function notifyRecipient(req, offer, recipientId, message) {
  const io = req.app.get('io');
  io?.to(`user:${recipientId}`).emit('notification:new', { messageId: message.id, offerId: offer.id });

  try {
    const [recipient, sender, service] = await Promise.all([
      User.findById(recipientId).select('email'),
      User.findById(message.senderId).select('businessName'),
      Service.findById(offer.serviceId).select('title'),
    ]);
    if (!recipient?.email) {
      console.warn(`[notifications] Cannot email message ${message.id}: recipient email is unavailable`);
      return;
    }
    const messageText = message.type === 'offer'
      ? `A service proposal was ${message.offerEvent?.action || 'updated'}.`
      : message.body;
    const conversationUrl = new URL(`/account/offers/${offer.id}`, env.clientUrl).toString();
    await sendMessageNotificationEmail(recipient.email, {
      senderName: sender?.businessName || 'An Escrit user',
      serviceName: service?.title || 'your service conversation',
      messageText,
      conversationUrl,
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
  emitToOffer(req, offer, 'conversation:message', message.toObject());
  await notifyRecipient(req, offer, recipientId, message);
  return message;
}

const createSchema = Joi.object({
  serviceId: Joi.string().hex().length(24).required(),
  priceNaira: Joi.number().min(100).max(100000000).required(),
  fulfilmentCriteria: Joi.string().trim().min(5).max(2000).required(),
  appointmentAt: Joi.date().iso().allow(null).default(null),
});

serviceOffersRouter.get('/', asyncHandler(async (req, res) => {
  const offers = await ServiceOffer.find({ $or: [{ buyerId: req.sellerId }, { sellerId: req.sellerId }] })
    .sort({ updatedAt: -1 })
    .populate('serviceId', 'title images basePrice')
    .populate('buyerId', 'businessName displayName profilePictureUrl')
    .populate('sellerId', 'businessName displayName profilePictureUrl');
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
  res.json({
    offers: offers.map((offer) => ({
      ...offer.toObject(),
      latestMessage: latestByOffer.get(String(offer._id)) || null,
      unreadCount: unreadByOffer.get(String(offer._id)) || 0,
    })),
  });
}));

serviceOffersRouter.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const service = await Service.findOne({ _id: req.body.serviceId, isActive: true, isVerified: true });
  if (!service) throw new AppError(404, 'Service is no longer available');
  if (String(service.seller) === String(req.sellerId)) throw new AppError(409, 'You cannot make an offer on your own service');
  const priceKobo = Math.round(req.body.priceNaira * 100);
  const offer = await ServiceOffer.create({
    serviceId: service._id,
    buyerId: req.sellerId,
    sellerId: service.seller,
    currentPriceKobo: priceKobo,
    fulfilmentCriteria: req.body.fulfilmentCriteria,
    appointmentAt: req.body.appointmentAt,
    offerHistory: [{ action: 'proposed', actorId: req.sellerId, priceKobo }],
  });
  await saveOfferMessage(req, offer, 'proposed', priceKobo);
  res.status(201).json({ offer });
}));

serviceOffersRouter.get('/:id/messages', asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  const now = new Date();
  await ConversationMessage.updateMany(
    { offerId: offer._id, recipientId: req.sellerId, readAt: null },
    { $set: { deliveredAt: now, readAt: now } }
  );
  const messages = await ConversationMessage.find({ offerId: offer._id }).sort({ createdAt: 1 });
  req.app.get('io')?.to(`user:${req.sellerId}`).emit('notification:read');
  emitToOffer(req, offer, 'conversation:read', { readerId: req.sellerId, readAt: now });
  res.json({ messages, offer });
}));

const messageSchema = Joi.object({ body: Joi.string().trim().min(1).max(2000).required() });
serviceOffersRouter.post('/:id/messages', validate(messageSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  const recipientId = String(req.sellerId) === String(offer.buyerId) ? offer.sellerId : offer.buyerId;
  const io = req.app.get('io');
  const recipientOnline = Boolean(io?.sockets.adapter.rooms.get(`user:${recipientId}`)?.size);
  const message = await ConversationMessage.create({
    offerId: offer._id,
    senderId: req.sellerId,
    recipientId,
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

serviceOffersRouter.post('/:id/counter', validate(counterSchema), asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
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

serviceOffersRouter.post('/:id/accept', asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  const isSellerAccepting = offer.status === 'PROPOSED' && String(offer.sellerId) === String(req.sellerId);
  const isBuyerAcceptingCounter = offer.status === 'COUNTERED' && String(offer.buyerId) === String(req.sellerId);
  if (!isSellerAccepting && !isBuyerAcceptingCounter) throw new AppError(409, 'This offer is no longer awaiting your response');

  const service = await Service.findOne({ _id: offer.serviceId, isActive: true, isVerified: true });
  if (!service) throw new AppError(409, 'This service is no longer available');
  const link = await Link.create({
    sellerId: offer.sellerId,
    itemName: service.title,
    itemDescription: offer.fulfilmentCriteria,
    itemPhotoUrl: service.images[0] || null,
    priceKobo: offer.currentPriceKobo,
    fulfillmentType: 'service',
    listingType: 'service',
    listingId: service._id,
    refundable: false,
  });
  offer.status = 'ACCEPTED';
  offer.agreedPriceKobo = offer.currentPriceKobo;
  offer.linkId = link._id;
  offer.offerHistory.push({ action: 'accepted', actorId: req.sellerId, priceKobo: offer.agreedPriceKobo });
  await offer.save();
  await saveOfferMessage(req, offer, 'accepted', offer.agreedPriceKobo);
  res.json({ offer, checkoutLinkId: link.id });
}));

serviceOffersRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  const offer = await loadOffer(req.params.id, req.sellerId);
  const recipientId = offer.status === 'PROPOSED' ? offer.sellerId : offer.buyerId;
  if (String(recipientId) !== String(req.sellerId) || !['PROPOSED', 'COUNTERED'].includes(offer.status)) {
    throw new AppError(409, 'This offer cannot be rejected by your account');
  }
  offer.status = 'REJECTED';
  offer.offerHistory.push({ action: 'rejected', actorId: req.sellerId, priceKobo: offer.currentPriceKobo });
  await offer.save();
  await saveOfferMessage(req, offer, 'rejected', offer.currentPriceKobo);
  res.json({ offer });
}));