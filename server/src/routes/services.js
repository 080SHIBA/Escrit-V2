import { Router } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { Service } from '../models/Service.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { ServiceDailyCapacity } from '../models/ServiceDailyCapacity.js';
import { Link } from '../models/Link.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { effectivePaymentOptions } from './marketplace.js';
import { ensureCheckoutPrice } from '../services/pricing.js';
import { getPaymentProviderName, initializeTransaction } from '../services/paymentProvider.js';
import { generateReference } from '../utils/reference.js';
import { env } from '../config/env.js';
import { deliveryReleaseTime } from '../../../shared/orderState.js';
import { completeDirectService, raiseDispute, releaseOnBuyerConfirmation, TX_STATUS } from '../services/escrow.js';
import { notifyUser } from '../services/notifications.js';
import {
  activeServiceReservationStatuses,
  localDateTimeToUtc,
  overlaps,
  slotReservationKeys,
} from '../services/serviceAvailability.js';

export const servicesRouter = Router();

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const daySchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value ? value : helpers.error('date.base');
}).required();
export const orderCreateSchema = Joi.object({
  idempotencyKey: Joi.string().trim().min(16).max(128).required(),
  appointmentAt: Joi.date().iso().allow(null).default(null),
  packageKey: Joi.string().trim().max(48).allow('').default(''),
  addOnKeys: Joi.array().items(Joi.string().trim().max(48)).max(20).unique().default([]),
  paymentMode: Joi.string().valid('escrow', 'direct').required(),
  directPaymentRiskAccepted: Joi.boolean().when('paymentMode', {
    is: 'direct',
    then: Joi.valid(true).required(),
    otherwise: Joi.valid(false).default(false),
  }),
  deliveryMethod: Joi.string().valid('online', 'provider_location', 'buyer_location', 'remote_deliverable', '').default(''),
  location: Joi.string().trim().max(500).allow('').default(''),
  details: Joi.string().trim().max(5000).allow('').default(''),
  termsAccepted: Joi.boolean().valid(true).required(),
});

function requireValidTimezone(timeZone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
  } catch {
    throw new AppError(422, 'The service has an invalid time zone. Contact the seller.');
  }
}

function localDateParts(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  return { year, month, day, weekday: dayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] };
}

function buildTerms(service, paymentMode, packageSnapshot, appointmentAt, deliveryMethod) {
  const payment = paymentMode === 'escrow'
    ? 'Payment is made using Escrit escrow. Completion and release follow the transaction terms.'
    : 'Payment is made directly to the provider without escrow. Escrit cannot hold or recover the money, and reporting does not guarantee a refund.';
  return [
    `Service: ${service.title}`,
    packageSnapshot ? `Selected scope: ${packageSnapshot.name}${packageSnapshot.description ? ` — ${packageSnapshot.description}` : ''}` : '',
    appointmentAt ? `Appointment: ${appointmentAt.toISOString()} (${service.timeZone}).` : '',
    deliveryMethod ? `Fulfilment: ${deliveryMethod}.` : '',
    service.deliverables?.length ? `Listed deliverables: ${service.deliverables.join('; ')}` : '',
    service.cancellationTerms ? `Cancellation: ${service.cancellationTerms}` : `Cancellation policy: ${service.cancellationPolicy}.`,
    service.reschedulePolicy ? `Rescheduling: ${service.reschedulePolicy}` : '',
    payment,
    paymentMode === 'direct'
      ? 'Direct-payment risk acknowledgement: the buyer understands Escrit cannot hold or recover direct payment, and reporting does not guarantee a refund.'
      : '',
    'These terms and the selected scope are saved with the order.',
  ].filter(Boolean).join('\n\n');
}

async function reserveDailyCapacity(serviceId, dateText, orderId, maximum) {
  const key = { serviceId, date: dateText };
  try {
    await ServiceDailyCapacity.updateOne(key, { $setOnInsert: key }, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const capacity = await ServiceDailyCapacity.findOneAndUpdate(
    {
      ...key,
      orderIds: { $ne: orderId },
      $expr: { $lt: [{ $size: '$orderIds' }, maximum] },
    },
    { $addToSet: { orderIds: orderId } },
    { new: true }
  );
  if (!capacity) throw new AppError(409, 'This provider has reached the daily booking limit. Choose another date.');
}

async function releaseDailyCapacity(serviceId, dateText, orderId) {
  if (!serviceId || !dateText) return;
  await ServiceDailyCapacity.updateOne(
    { serviceId, date: dateText },
    { $pull: { orderIds: orderId } }
  );
}

async function serviceAvailability(service, dateText, now = new Date(), excludeOrderId = null) {
  requireValidTimezone(service.timeZone);
  const expired = await ServiceOrder.find({
    sellerId: service.seller,
    status: 'pending_approval',
    reservationActive: true,
    reservationExpiresAt: { $lte: now },
  }).select('_id serviceId capacityDate');
  for (const order of expired) {
    const result = await ServiceOrder.updateOne(
      { _id: order._id, status: 'pending_approval', reservationActive: true },
      { $set: { reservationActive: false, status: 'cancelled', cancelledAt: now }, $push: { events: { status: 'cancelled', actorId: service.seller, note: 'Appointment hold expired.' } } }
    );
    if (result.modifiedCount) await releaseDailyCapacity(order.serviceId, order.capacityDate, order._id);
  }
  const { year, month, day, weekday } = localDateParts(dateText);
  const schedule = service.availability.find((entry) => entry.day === weekday);
  if (!schedule) return [];
  const dayStart = localDateTimeToUtc(dateText, '00:00', service.timeZone);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  const dayEnd = localDateTimeToUtc(nextDate, '00:00', service.timeZone);
  if (!dayStart || !dayEnd) throw new AppError(422, 'Could not resolve this service date in its time zone.');
  const existing = await ServiceOrder.find({
    sellerId: service.seller,
    ...(excludeOrderId ? { _id: { $ne: excludeOrderId } } : {}),
    appointmentAt: { $gte: dayStart, $lt: dayEnd },
    status: { $in: activeServiceReservationStatuses() },
    $or: [{ reservationExpiresAt: null }, { reservationExpiresAt: { $gt: now } }],
  }).select('appointmentAt durationMinutes reservationActive');
  const capacity = await ServiceDailyCapacity.findOne({ serviceId: service._id, date: dateText }).select('orderIds');
  const seenOrders = new Set(existing.map((order) => String(order._id)));
  for (const id of capacity?.orderIds || []) {
    if (!excludeOrderId || String(id) !== String(excludeOrderId)) seenOrders.add(String(id));
  }
  const dayCount = seenOrders.size;
  if (dayCount >= service.maxBookingsPerDay) return [];

  const duration = service.durationMinutes;
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const available = [];
  for (let minute = start; minute + duration <= end; minute += 15) {
    const slot = localDateTimeToUtc(
      dateText,
      `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
      service.timeZone
    );
    if (!slot || slot.getTime() < now.getTime() + service.bookingLeadTimeHours * 3_600_000) continue;
    const slotEnd = new Date(slot.getTime() + duration * 60_000);
    if (service.blockedDates.some((blocked) => overlaps(slot, slotEnd, blocked.startAt, blocked.endAt))) continue;
    if (existing.some((order) => overlaps(
      slot,
      new Date(slotEnd.getTime() + service.reservationMinutes * 60_000),
      order.appointmentAt,
      new Date(order.appointmentAt.getTime() + (order.durationMinutes || duration) * 60_000 + service.reservationMinutes * 60_000)
    ))) continue;
    available.push(slot.toISOString());
  }

  return available;
}

function selectedScope(service, body) {
  if (service.serviceModel === 'appointment') return { packageSnapshot: null, addOns: [], amountNaira: service.basePrice };
  if (service.serviceModel === 'custom_quote') throw new AppError(409, 'This service requires a quote. Start a conversation with the seller to agree the scope and price.');
  const packageSnapshot = service.packages.find((item) => item.key === body.packageKey);
  if (!packageSnapshot) throw new AppError(422, 'Choose an available service package.');
  const addOns = body.addOnKeys.map((key) => {
    const addOn = service.addOns.find((item) => item.key === key);
    if (!addOn) throw new AppError(422, 'One of the selected extras is no longer available.');
    return { key: addOn.key, name: addOn.name, description: addOn.description, priceNaira: addOn.priceNaira };
  });
  return {
    packageSnapshot: {
      key: packageSnapshot.key,
      name: packageSnapshot.name,
      description: packageSnapshot.description,
      priceNaira: packageSnapshot.priceNaira,
      deliveryDays: packageSnapshot.deliveryDays,
      deliverables: packageSnapshot.deliverables,
    },
    addOns,
    amountNaira: packageSnapshot.priceNaira + addOns.reduce((sum, item) => sum + item.priceNaira, 0),
  };
}

async function loadBuyerAndService(serviceId, buyerId) {
  const [service, buyer] = await Promise.all([
    Service.findOne({ _id: serviceId, isActive: true, isVerified: true }),
    User.findById(buyerId),
  ]);
  if (!service) throw new AppError(404, 'Service is no longer available.');
  if (!buyer) throw new AppError(404, 'Account not found.');
  if (String(service.seller) === String(buyerId)) throw new AppError(409, 'You cannot book your own service.');
  if (await User.exists({ _id: service.seller, isDemoSeed: true })) throw new AppError(409, 'Demo services cannot accept real bookings.');
  return { service, buyer };
}

async function createOrLoadServiceOrder(service, buyerId, body) {
  const existing = await ServiceOrder.findOne({ buyerId, idempotencyKey: body.idempotencyKey });
  if (existing) {
    if (String(existing.serviceId) !== String(service._id)) throw new AppError(409, 'That idempotency key has already been used for another service order.');
    return { order: existing, created: false };
  }
  const { packageSnapshot, addOns, amountNaira } = selectedScope(service, body);
  const seller = await User.findById(service.seller);
  const options = effectivePaymentOptions(service, seller);
  if (!options[body.paymentMode]) throw new AppError(409, 'That payment option is not available for this service.');
  if (body.paymentMode === 'direct' && !seller?.bankAccount) throw new AppError(409, 'This seller is not ready to receive direct payment.');
  if (!Number.isFinite(amountNaira) || amountNaira < 100) throw new AppError(422, 'The service price must be at least ₦100.');

  let appointmentAt = null;
  let slotKeys = [];
  let capacityDate = '';
  let reservedDailyCapacity = false;
  if (service.serviceModel === 'appointment') {
    if (!body.appointmentAt) throw new AppError(422, 'Choose an available appointment time.');
    appointmentAt = new Date(body.appointmentAt);
    const dateText = new Intl.DateTimeFormat('en-CA', {
      timeZone: service.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(appointmentAt);
    const available = await serviceAvailability(service, dateText);
    if (!available.includes(appointmentAt.toISOString())) throw new AppError(409, 'That appointment is no longer available. Choose another time.');
    slotKeys = slotReservationKeys(appointmentAt, service.durationMinutes, service.reservationMinutes);
    capacityDate = dateText;
  }

  const status = service.serviceModel === 'appointment' ? 'pending_approval' : 'awaiting_payment';
  const termsSnapshot = buildTerms(service, body.paymentMode, packageSnapshot, appointmentAt, body.deliveryMethod);
  const orderId = appointmentAt ? new mongoose.Types.ObjectId() : undefined;
  try {
    if (appointmentAt) {
      await reserveDailyCapacity(service._id, capacityDate, orderId, service.maxBookingsPerDay);
      reservedDailyCapacity = true;
    }
    const order = await ServiceOrder.create({
      ...(orderId ? { _id: orderId } : {}),
      serviceId: service._id,
      sellerId: service.seller,
      buyerId,
      kind: service.serviceModel,
      status,
      paymentMode: body.paymentMode,
      appointmentAt,
      capacityDate,
      durationMinutes: appointmentAt ? service.durationMinutes : null,
      timeZone: service.timeZone,
      deliveryMethod: body.deliveryMethod,
      location: body.location,
      details: body.details,
      packageSnapshot,
      addOnsSnapshot: addOns,
      amountKobo: Math.round(amountNaira * 100),
      termsSnapshot,
      termsAcceptedAt: new Date(),
      directPaymentRiskAcceptedAt: body.directPaymentRiskAccepted ? new Date() : null,
      idempotencyKey: body.idempotencyKey,
      reservationActive: Boolean(appointmentAt),
      reservationExpiresAt: appointmentAt ? new Date(Date.now() + service.reservationMinutes * 60_000) : null,
      slotKeys,
      maxRevisions: packageSnapshot ? service.maxRevisions : 0,
      events: [{ status, actorId: buyerId }],
    });
    return { order, created: true };
  } catch (error) {
    if (reservedDailyCapacity) await releaseDailyCapacity(service._id, capacityDate, orderId);
    if (error?.code !== 11000) throw error;
    const order = await ServiceOrder.findOne({ buyerId, idempotencyKey: body.idempotencyKey });
    if (order) return { order, created: false };
    throw new AppError(409, 'That appointment was just reserved by another buyer. Choose another time.');
  }
}

function orderIsParticipant(order, userId) {
  return String(order.buyerId) === String(userId) || String(order.sellerId) === String(userId);
}

function notifyOrder(req, order, recipientId, status, message, dedupeKey = `service-order:${order.id}:${status}`) {
  return notifyUser({
    io: req.app.get('io'),
    recipientId,
    type: 'service_order',
    title: 'Service order updated',
    message,
    href: '/account/service-orders',
    dedupeKey,
  });
}

async function startCheckout(order, buyerId) {
  if (String(order.buyerId) !== String(buyerId)) throw new AppError(403, 'Only the buyer can start checkout.');
  if (order.status !== 'awaiting_payment') throw new AppError(409, 'This order is not ready for payment.');
  const buyer = await User.findById(buyerId);
  if (!buyer?.fullName || !buyer.nin) throw new AppError(403, 'Complete your identity details in Profile settings before checkout.');
  const service = await Service.findById(order.serviceId);
  if (!service) throw new AppError(404, 'Service listing not found.');
  const seller = await User.findById(order.sellerId);
  if (order.paymentMode === 'direct' && !seller?.bankAccount) throw new AppError(409, 'This seller is not ready to receive direct payment.');

  let link = order.checkoutLinkId ? await Link.findById(order.checkoutLinkId) : null;
  if (!link) {
    link = await Link.create({
      sellerId: order.sellerId,
      itemName: service.title,
      itemDescription: order.termsSnapshot,
      termsSnapshot: order.termsSnapshot,
      itemPhotoUrl: service.images[0] || null,
      priceKobo: order.amountKobo,
      fulfillmentType: 'service',
      listingType: 'service',
      listingId: service._id,
      refundable: false,
    });
    await ServiceOrder.updateOne({ _id: order._id, checkoutLinkId: null }, { $set: { checkoutLinkId: link._id } });
    order.checkoutLinkId = link._id;
  }
  const buyerPriceKobo = await ensureCheckoutPrice(link);
  if (buyerPriceKobo == null) throw new AppError(503, 'The checkout total is temporarily unavailable.');

  let transaction = order.transactionId ? await Transaction.findById(order.transactionId) : null;
  if (!transaction) {
    const candidate = await Transaction.create({
      linkId: link._id,
      paymentProvider: await getPaymentProviderName(),
      paymentReference: generateReference(`escrit-service-${order.id}`),
      checkoutMode: order.paymentMode,
      checkoutTotalKobo: buyerPriceKobo,
      buyerPriceKoboSnapshot: buyerPriceKobo,
      sellerPayoutBaseKobo: order.amountKobo,
      buyerUserId: buyer._id,
      buyerEmail: buyer.email,
      termsAcceptedAt: order.termsAcceptedAt,
      termsSnapshot: order.termsSnapshot,
      serviceOrderId: order._id,
      serviceOrderKind: order.kind,
    });
    const claimed = await ServiceOrder.findOneAndUpdate(
      { _id: order._id, status: 'awaiting_payment', transactionId: null },
      { $set: { transactionId: candidate._id, paymentStatus: 'processing' } },
      { new: true }
    );
    if (claimed) {
      transaction = candidate;
      order.transactionId = candidate._id;
      order.paymentStatus = 'processing';
    } else {
      await Transaction.deleteOne({ _id: candidate._id });
      const latestOrder = await ServiceOrder.findById(order._id);
      if (latestOrder?.status !== 'awaiting_payment') throw new AppError(409, 'This service order is no longer ready for payment.');
      transaction = latestOrder.transactionId ? await Transaction.findById(latestOrder.transactionId) : null;
    }
  }
  if (!transaction) throw new AppError(500, 'Could not prepare this service payment.');
  const totalKobo = transaction.checkoutTotalKobo || buyerPriceKobo;
  if (transaction.checkoutTotalKobo == null) {
    transaction.checkoutTotalKobo = buyerPriceKobo;
    transaction.buyerPriceKoboSnapshot = buyerPriceKobo;
    await transaction.save();
  }
  if (order.authorizationUrl && transaction.paymentProviderTransactionId) {
    return { authorizationUrl: order.authorizationUrl, transactionId: transaction.id, totalKobo };
  }

  const payment = await initializeTransaction({
    email: buyer.email,
    amountKobo: totalKobo,
    reference: transaction.paymentReference,
    callbackUrl: `${env.clientOrigins[0]}/r/${link.id}/t/${transaction.id}/result`,
    metadata: {
      transactionId: transaction.id,
      listingType: 'service',
      listingId: service.id,
      serviceOrderId: order.id,
      checkoutMode: order.paymentMode,
    },
  });
  transaction.paymentProviderTransactionId = payment.id ? String(payment.id) : null;
  await transaction.save();
  order.authorizationUrl = payment.authorization_url;
  await order.save();
  return { authorizationUrl: payment.authorization_url, transactionId: transaction.id, totalKobo };
}

servicesRouter.get('/:id/availability', asyncHandler(async (req, res) => {
  const { date } = await Joi.object({ date: daySchema }).validateAsync(req.query);
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service listing id.');
  const service = await Service.findOne({ _id: req.params.id, isActive: true, isVerified: true });
  if (!service) throw new AppError(404, 'Service is no longer available.');
  if (service.serviceModel !== 'appointment') return res.json({ date, timeZone: service.timeZone, slots: [] });
  res.json({ date, timeZone: service.timeZone, slots: await serviceAvailability(service, date) });
}));

servicesRouter.post('/:id/orders', requireAuth, validate(orderCreateSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service listing id.');
  const { service, buyer } = await loadBuyerAndService(req.params.id, req.sellerId);
  if (buyer._id.toString() !== req.sellerId) throw new AppError(403, 'Could not validate buyer account.');
  const { order, created } = await createOrLoadServiceOrder(service, req.sellerId, req.body);
  if (created) await notifyOrder(req, order, service.seller, order.status, 'A buyer submitted a service order for your review.');
  res.status(created ? 201 : 200).json({ order, created });
}));

servicesRouter.get('/orders/me', requireAuth, asyncHandler(async (req, res) => {
  const orders = await ServiceOrder.find({ $or: [{ buyerId: req.sellerId }, { sellerId: req.sellerId }] })
    .sort({ updatedAt: -1 })
    .populate('serviceId', 'title images category serviceModel')
    .populate('buyerId', 'displayName businessName profilePictureUrl')
    .populate('sellerId', 'displayName businessName profilePictureUrl')
    .populate('transactionId', 'status');
  res.json({ orders });
}));

servicesRouter.post('/orders/:id/checkout', requireAuth, asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  res.json(await startCheckout(order, req.sellerId));
}));

const orderActionSchema = Joi.object({ note: Joi.string().trim().max(1000).allow('').default('') });
const orderMessageSchema = Joi.object({ message: Joi.string().trim().min(1).max(1000).required() });
const disputeSchema = Joi.object({ reason: Joi.string().trim().min(5).max(500).required() });
const rescheduleRequestSchema = Joi.object({
  appointmentAt: Joi.date().iso().required(),
  note: Joi.string().trim().max(800).allow('').default(''),
});
const rescheduleConfirmSchema = Joi.object({ note: Joi.string().trim().max(800).allow('').default('') });

servicesRouter.post('/orders/:id/confirm', requireAuth, validate(orderActionSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.sellerId) !== String(req.sellerId)) throw new AppError(403, 'Only the service provider can confirm this request.');
  const changed = await ServiceOrder.findOneAndUpdate(
    { _id: order._id, status: 'pending_approval' },
    { $set: { status: 'awaiting_payment', reservationExpiresAt: null }, $push: { events: { status: 'awaiting_payment', actorId: req.sellerId, note: req.body.note } } },
    { new: true }
  );
  if (!changed) throw new AppError(409, 'This request is no longer awaiting provider approval.');
  await releaseDailyCapacity(changed.serviceId, changed.capacityDate, changed._id);
  await notifyOrder(req, changed, changed.buyerId, changed.status, 'The provider confirmed your appointment request. Payment is ready.');
  res.json({ order: changed });
}));

servicesRouter.post('/orders/:id/decline', requireAuth, validate(orderActionSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.sellerId) !== String(req.sellerId)) throw new AppError(403, 'Only the service provider can decline this request.');
  const changed = await ServiceOrder.findOneAndUpdate(
    { _id: order._id, status: 'pending_approval' },
    { $set: { status: 'declined', reservationActive: false, cancelledAt: new Date() }, $push: { events: { status: 'declined', actorId: req.sellerId, note: req.body.note } } },
    { new: true }
  );
  if (!changed) throw new AppError(409, 'This request is no longer awaiting provider approval.');
  await releaseDailyCapacity(changed.serviceId, changed.capacityDate, changed._id);
  await notifyOrder(req, changed, changed.buyerId, changed.status, 'The provider declined your appointment request.');
  res.json({ order: changed });
}));

servicesRouter.post('/orders/:id/cancel', requireAuth, validate(orderActionSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (!orderIsParticipant(order, req.sellerId)) throw new AppError(403, 'This service order belongs to another account.');
  if (!['pending_approval', 'awaiting_payment'].includes(order.status) || order.paymentStatus !== 'unpaid' || order.transactionId) {
    throw new AppError(409, 'This order can no longer be cancelled here. Contact the other party for help.');
  }
  const changed = await ServiceOrder.findOneAndUpdate(
    { _id: order._id, status: order.status, paymentStatus: 'unpaid', transactionId: null },
    { $set: { status: 'cancelled', reservationActive: false, cancelledAt: new Date() }, $push: { events: { status: 'cancelled', actorId: req.sellerId, note: req.body.note } } },
    { new: true }
  );
  if (!changed) throw new AppError(409, 'This order changed while it was being cancelled.');
  await releaseDailyCapacity(changed.serviceId, changed.capacityDate, changed._id);
  const recipientId = String(changed.buyerId) === String(req.sellerId) ? changed.sellerId : changed.buyerId;
  await notifyOrder(req, changed, recipientId, changed.status, 'A service order was cancelled.');
  res.json({ order: changed });
}));

servicesRouter.post('/orders/:id/messages', requireAuth, validate(orderMessageSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (!orderIsParticipant(order, req.sellerId)) throw new AppError(403, 'This service order belongs to another account.');
  const updated = await ServiceOrder.findOneAndUpdate(
    { _id: order._id },
    { $push: { events: { status: 'message', actorId: req.sellerId, note: req.body.message } } },
    { new: true }
  );
  const recipientId = String(updated.buyerId) === String(req.sellerId) ? updated.sellerId : updated.buyerId;
  await notifyUser({
    io: req.app.get('io'),
    recipientId,
    type: 'service_order',
    title: 'New service order message',
    message: req.body.message.slice(0, 160),
    href: '/account/service-orders',
    dedupeKey: `service-order-message:${updated.id}:${Date.now()}`,
  });
  res.json({ order: updated });
}));

servicesRouter.post('/orders/:id/dispute', requireAuth, validate(disputeSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.buyerId) !== String(req.sellerId)) throw new AppError(403, 'Only the buyer can open a dispute.');
  if (order.paymentMode !== 'escrow' || order.paymentStatus !== 'paid' || !order.transactionId) {
    throw new AppError(409, 'Only a paid escrow service order can be disputed here. Direct payments cannot be held or recovered by Escrit.');
  }
  const transaction = await Transaction.findById(order.transactionId);
  if (!transaction) throw new AppError(409, 'The verified payment record for this order could not be found.');
  const disputed = await raiseDispute(transaction, req.body.reason);
  const changed = await ServiceOrder.findOneAndUpdate(
    { _id: order._id, status: { $nin: ['completed', 'cancelled', 'declined'] } },
    { $set: { status: 'disputed' }, $push: { events: { status: 'disputed', actorId: req.sellerId, note: req.body.reason } } },
    { new: true }
  );
  if (!changed) throw new AppError(409, 'The service order changed while the dispute was being opened.');
  await notifyOrder(req, changed, changed.sellerId, changed.status, 'The buyer opened a dispute for this escrow service order.');
  res.json({ order: changed, transaction: disputed });
}));

servicesRouter.post('/orders/:id/reschedule-request', requireAuth, validate(rescheduleRequestSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.buyerId) !== String(req.sellerId)) throw new AppError(403, 'Only the buyer can request a new appointment time.');
  if (!order.appointmentAt || !['awaiting_payment', 'ready_to_start', 'confirmed'].includes(order.status) || order.paymentStatus === 'processing') {
    throw new AppError(409, 'This appointment cannot be rescheduled at its current stage.');
  }
  const service = await Service.findById(order.serviceId);
  if (!service || service.serviceModel !== 'appointment') throw new AppError(409, 'This order does not support appointment rescheduling.');
  const requestedAt = new Date(req.body.appointmentAt);
  const dateText = new Intl.DateTimeFormat('en-CA', {
    timeZone: service.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(requestedAt);
  const available = await serviceAvailability(service, dateText, new Date(), order._id);
  if (!available.includes(requestedAt.toISOString())) throw new AppError(409, 'That appointment time is unavailable. Choose another time.');
  const note = `Requested appointment change to ${requestedAt.toISOString()}.${req.body.note ? ` ${req.body.note}` : ''}`;
  order.requestedAppointmentAt = requestedAt;
  order.events.push({ status: 'reschedule_requested', actorId: req.sellerId, note });
  await order.save();
  await notifyOrder(
    req,
    order,
    order.sellerId,
    'reschedule_requested',
    'The buyer requested a new appointment time. Review it in the order conversation.',
    `service-order:${order.id}:reschedule-request:${Date.now()}`
  );
  res.json({ order });
}));

servicesRouter.post('/orders/:id/reschedule-confirm', requireAuth, validate(rescheduleConfirmSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.sellerId) !== String(req.sellerId)) throw new AppError(403, 'Only the service provider can confirm a new appointment time.');
  if (!order.requestedAppointmentAt || !order.appointmentAt || !['awaiting_payment', 'ready_to_start', 'confirmed'].includes(order.status) || order.paymentStatus === 'processing') {
    throw new AppError(409, 'There is no rescheduling request to confirm.');
  }
  const service = await Service.findById(order.serviceId);
  if (!service || service.serviceModel !== 'appointment') throw new AppError(409, 'This order does not support appointment rescheduling.');
  const requestedAt = new Date(order.requestedAppointmentAt);
  const dateText = new Intl.DateTimeFormat('en-CA', {
    timeZone: service.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(requestedAt);
  const available = await serviceAvailability(service, dateText, new Date(), order._id);
  if (!available.includes(requestedAt.toISOString())) throw new AppError(409, 'That appointment time is no longer available. Ask the buyer to choose another time.');
  const previousAt = order.appointmentAt;
  const update = {
    appointmentAt: requestedAt,
    capacityDate: dateText,
    slotKeys: slotReservationKeys(requestedAt, order.durationMinutes, service.reservationMinutes),
    requestedAppointmentAt: null,
  };
  const note = `Provider confirmed appointment change from ${previousAt.toISOString()} to ${requestedAt.toISOString()}.${req.body.note ? ` ${req.body.note}` : ''}`;
  let changed;
  try {
    changed = await ServiceOrder.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        appointmentAt: previousAt,
        requestedAppointmentAt: requestedAt,
      },
      { $set: update, $push: { events: { status: 'rescheduled', actorId: req.sellerId, note } } },
      { new: true }
    );
  } catch (error) {
    if (error?.code === 11000) throw new AppError(409, 'That appointment was just reserved by another buyer. Ask for another time.');
    throw error;
  }
  if (!changed) throw new AppError(409, 'This appointment changed while the provider was confirming the request.');
  await notifyOrder(req, changed, changed.buyerId, 'rescheduled', 'The provider confirmed your new appointment time.');
  res.json({ order: changed });
}));

servicesRouter.post('/orders/:id/start', requireAuth, validate(orderActionSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.sellerId) !== String(req.sellerId)) throw new AppError(403, 'Only the service provider can start this order.');
  const updated = await ServiceOrder.findOneAndUpdate(
    { _id: order._id, status: { $in: ['ready_to_start', 'confirmed'] }, paymentStatus: 'paid' },
    { $set: { status: 'in_progress' }, $push: { events: { status: 'in_progress', actorId: req.sellerId, note: req.body.note } } },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'This order is not ready to start.');
  await notifyOrder(req, updated, updated.buyerId, updated.status, 'The provider marked your service order as in progress.');
  res.json({ order: updated });
}));

const deliverSchema = Joi.object({
  note: Joi.string().trim().max(1000).allow('').default(''),
  deliverables: Joi.array().items(Joi.object({
    url: Joi.string().uri({ scheme: ['https'] }).max(1000).required(),
    note: Joi.string().trim().max(1000).allow('').default(''),
  })).max(20).default([]),
});

servicesRouter.post('/orders/:id/deliver', requireAuth, validate(deliverSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.sellerId) !== String(req.sellerId)) throw new AppError(403, 'Only the service provider can submit delivery.');
  const transaction = order.transactionId ? await Transaction.findById(order.transactionId).populate('linkId') : null;
  if (transaction?.status === TX_STATUS.PAID_HELD) {
    const deliveredAt = new Date();
    transaction.fulfillmentStatus = 'SERVICE_COMPLETE';
    transaction.fulfillmentUpdatedAt = deliveredAt;
    transaction.deliveredAt = deliveredAt;
    transaction.releaseDueAt = deliveryReleaseTime(deliveredAt, transaction.releaseWindowHours);
    await transaction.save();
  } else if (transaction?.status === TX_STATUS.DIRECT_PAID) {
    await completeDirectService(transaction, req.sellerId);
  } else if (order.paymentMode === 'escrow' && transaction?.status !== TX_STATUS.PAID_HELD) {
    throw new AppError(409, 'The escrow payment is not held for this order.');
  } else if (order.paymentMode === 'direct' && ![TX_STATUS.DIRECT_COMPLETED, TX_STATUS.DIRECT_PAID].includes(transaction?.status)) {
    throw new AppError(409, 'The direct payment is not confirmed for this order.');
  }
  const updated = await ServiceOrder.findOneAndUpdate(
    { _id: order._id, status: 'in_progress', paymentStatus: 'paid' },
    {
      $set: { status: 'delivered' },
      $push: {
        events: { status: 'delivered', actorId: req.sellerId, note: req.body.note },
        deliverables: { $each: req.body.deliverables },
      },
    },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'This order is not in progress.');
  await notifyOrder(req, updated, updated.buyerId, updated.status, 'The provider submitted a service delivery for your review.');
  res.json({ order: updated });
}));

servicesRouter.post('/orders/:id/revision', requireAuth, validate(orderActionSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.buyerId) !== String(req.sellerId)) throw new AppError(403, 'Only the buyer can request revisions.');
  if (order.status !== 'delivered' || order.revisionCount >= order.maxRevisions) throw new AppError(409, 'No revisions are available for this order.');
  if (order.paymentMode === 'escrow') {
    const transaction = order.transactionId ? await Transaction.findById(order.transactionId) : null;
    if (transaction?.status !== TX_STATUS.PAID_HELD) throw new AppError(409, 'The escrow transaction is no longer held; a revision cannot be requested.');
    transaction.fulfillmentStatus = 'NOT_STARTED';
    transaction.fulfillmentUpdatedAt = null;
    transaction.deliveredAt = null;
    transaction.releaseDueAt = null;
    await transaction.save();
  }
  order.revisionCount += 1;
  order.status = 'revision_requested';
  order.events.push({ status: order.status, actorId: req.sellerId, note: req.body.note });
  await order.save();
  await notifyOrder(req, order, order.sellerId, order.status, 'The buyer requested an included revision.');
  res.json({ order });
}));

servicesRouter.post('/orders/:id/accept', requireAuth, validate(orderActionSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid service order id.');
  const order = await ServiceOrder.findById(req.params.id);
  if (!order) throw new AppError(404, 'Service order not found.');
  if (String(order.buyerId) !== String(req.sellerId)) throw new AppError(403, 'Only the buyer can confirm completion.');
  if (order.status !== 'delivered' || order.paymentStatus !== 'paid') throw new AppError(409, 'This order is not awaiting completion confirmation.');
  const transaction = order.transactionId ? await Transaction.findById(order.transactionId).populate('linkId') : null;
  if (order.paymentMode === 'escrow') {
    if (!transaction || transaction.status !== TX_STATUS.PAID_HELD) throw new AppError(409, 'The escrow transaction is not ready for completion confirmation.');
    await releaseOnBuyerConfirmation(transaction);
  }
  order.status = 'completed';
  order.reservationActive = false;
  order.events.push({ status: 'completed', actorId: req.sellerId, note: req.body.note });
  await order.save();
  await notifyOrder(req, order, order.sellerId, order.status, 'The buyer confirmed service completion.');
  res.json({ order });
}));
