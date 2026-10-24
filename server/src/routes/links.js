import { Router } from 'express';
import Joi from 'joi';
import { Link } from '../models/Link.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { reconcileWithPaymentProvider, completeDirectService } from '../services/escrow.js';
import { createUploadSignature } from '../services/cloudinary.js';
import { quoteCollectionFee } from '../services/paymentProvider.js';
import { refundProductNoShow, resolveNonRefundableProductNoShow } from '../services/escrow.js';
import { env } from '../config/env.js';
import { deliveryReleaseTime } from '../../../shared/orderState.js';
import { DEFAULT_RELEASE_WINDOW_HOURS, RELEASE_WINDOW_OPTIONS } from '../../../shared/releaseConditions.js';

export const linksRouter = Router();
linksRouter.use(requireAuth);

const releaseWindowValues = RELEASE_WINDOW_OPTIONS.map(({ hours }) => hours);

const createLinkSchema = Joi.object({
  itemName: Joi.string().min(2).max(120).required(),
  itemDescription: Joi.string().max(1000).allow('').default(''),
  termsSnapshot: Joi.string().trim().max(1500).allow('').default(''),
  releaseWindowHours: Joi.number().integer().valid(...releaseWindowValues).default(DEFAULT_RELEASE_WINDOW_HOURS),
  // https only: browsers block http images on an https page.
  itemPhotoUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow(null).default(null),
  priceNaira: Joi.number().min(100).required(), // collected in naira, stored in kobo
});

// Signed parameters for a direct browser-to-Cloudinary photo upload.
linksRouter.post('/upload-signature', uploadLimiter, asyncHandler(async (_req, res) => {
  res.json(createUploadSignature());
}));

// Creates the shareable link. No Transaction exists until a buyer
// starts checkout, so a link can sit with zero orders indefinitely.
linksRouter.post('/', validate(createLinkSchema), asyncHandler(async (req, res) => {
  const seller = await User.findById(req.sellerId);
  if (seller?.kycStatus !== 'verified') {
    throw new AppError(422, 'Verify your identity before creating a payment link');
  }
  if (!seller?.bankAccount) {
    // Checked here as well as in the UI: no link goes live without a payout destination.
    throw new AppError(422, 'Add a verified bank account before creating a payment link');
  }

  const { itemName, itemDescription, termsSnapshot, itemPhotoUrl, priceNaira, releaseWindowHours } = req.body;
  const storedTermsSnapshot = termsSnapshot || itemDescription || 'The seller will confirm delivery details with you before checkout.';
  const link = await Link.create({
    sellerId: seller.id,
    itemName,
    itemDescription,
    termsSnapshot: storedTermsSnapshot,
    releaseWindowHours,
    itemPhotoUrl,
    priceKobo: Math.round(priceNaira * 100),
    checkoutPriceKobo: Math.round(priceNaira * 100) + await quoteCollectionFee(Math.round(priceNaira * 100)),
  });

  res.status(201).json({ link });
}));

// Zeroed per-status counters, so the dashboard can show "2 held, 1
// disputed" without downloading every transaction.
function emptyCounts() {
  return Object.fromEntries(Object.values(TX_STATUS).map((s) => [s, 0]));
}

linksRouter.get('/', asyncHandler(async (req, res) => {
  const links = await Link.find({ sellerId: req.sellerId }).sort({ createdAt: -1 });
  const linkIds = links.map((l) => l._id);

  // Re-check unpaid orders with the payment provider so a delayed webhook never
  // leaves the seller looking at a stale "awaiting payment" status.
  const pending = await Transaction.find({ linkId: { $in: linkIds }, status: TX_STATUS.CREATED });
  await Promise.all(pending.map(reconcileWithPaymentProvider));

  const counts = await Transaction.aggregate([
    { $match: { linkId: { $in: linkIds } } },
    { $group: { _id: { linkId: '$linkId', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const countsByLink = {};
  for (const { _id, count } of counts) {
    const key = String(_id.linkId);
    countsByLink[key] = countsByLink[key] || emptyCounts();
    countsByLink[key][_id.status] = count;
  }

  res.json({
    links: links.map((link) => ({
      link,
      transactionCounts: countsByLink[String(link._id)] || emptyCounts(),
    })),
  });
}));

linksRouter.get('/:id', asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, sellerId: req.sellerId });
  if (!link) throw new AppError(404, 'Link not found');

  const transactions = await Transaction.find({ linkId: link._id }).sort({ createdAt: -1 });
  const reconciled = await Promise.all(
    transactions.map((tx) => (tx.status === TX_STATUS.CREATED ? reconcileWithPaymentProvider(tx, req.app.get('io')) : tx))
  );

  res.json({ link, transactions: reconciled });
}));

const updateLinkSchema = Joi.object({
  active: Joi.boolean().required(),
});

const fulfillmentSchema = Joi.object({
  status: Joi.string().valid('IN_TRANSIT', 'READY_FOR_MEETING', 'DELIVERED', 'SERVICE_COMPLETE', 'BUYER_NO_SHOW').required(),
  trackingReference: Joi.string().max(160).allow('').default(''),
  note: Joi.string().max(500).allow('').default(''),
  proofUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
});

linksRouter.patch('/:id/transactions/:txId/fulfillment', validate(fulfillmentSchema), asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, sellerId: req.sellerId });
  if (!link) throw new AppError(404, 'Link not found');

  const tx = await Transaction.findOne({ _id: req.params.txId, linkId: link._id });
  if (!tx) throw new AppError(404, 'Order not found');
  if (tx.status === TX_STATUS.DIRECT_PAID) {
    if (req.body.status !== 'SERVICE_COMPLETE') throw new AppError(409, 'Direct service bookings can only be marked complete');
    const completed = await completeDirectService(tx, req.sellerId);
    return res.json({ transaction: completed });
  }
  if (tx.status !== TX_STATUS.PAID_HELD) throw new AppError(409, 'Fulfillment can only be updated while payment is held');
  if (
    ['DELIVERED', 'SERVICE_COMPLETE'].includes(tx.fulfillmentStatus) &&
    req.body.status !== tx.fulfillmentStatus
  ) {
    throw new AppError(409, 'Delivered orders cannot return to an earlier fulfillment status');
  }

  const serviceStatuses = ['READY_FOR_MEETING', 'SERVICE_COMPLETE', 'BUYER_NO_SHOW'];
  const productStatuses = ['IN_TRANSIT', 'DELIVERED', 'BUYER_NO_SHOW'];
  const allowed = link.fulfillmentType === 'service' ? serviceStatuses : productStatuses;
  if (!allowed.includes(req.body.status)) throw new AppError(400, 'That fulfillment status does not match this listing type');
  if (req.body.status === 'DELIVERED' && link.fulfillmentType === 'service') {
    throw new AppError(400, 'Use service completion for service listings');
  }
  if (req.body.status === 'SERVICE_COMPLETE' && link.fulfillmentType !== 'service') {
    throw new AppError(400, 'Service completion is only valid for service listings');
  }
  if (req.body.status === 'DELIVERED' && !req.body.proofUrl) {
    throw new AppError(422, 'Attach a delivery photo before marking this order delivered');
  }

  tx.fulfillmentStatus = req.body.status;
  tx.trackingReference = req.body.trackingReference;
  tx.fulfillmentNote = req.body.note;
  tx.deliveryProofUrl = req.body.proofUrl;
  tx.fulfillmentUpdatedAt = new Date();
  if (['DELIVERED', 'SERVICE_COMPLETE'].includes(req.body.status) && !tx.deliveredAt) {
    tx.deliveredAt = tx.fulfillmentUpdatedAt;
    tx.releaseDueAt = deliveryReleaseTime(tx.fulfillmentUpdatedAt, tx.releaseWindowHours);
  }
  if (req.body.status === 'BUYER_NO_SHOW') {
    tx.buyerNoShowAt = new Date();
    if (link.fulfillmentType === 'service') {
      tx.noShowResponseDueAt = new Date(Date.now() + env.noShowResponseDays * 24 * 60 * 60 * 1000);
    }
  }
  await tx.save();
  if (req.body.status === 'BUYER_NO_SHOW' && link.fulfillmentType === 'product' && link.refundable) {
    const refunded = await refundProductNoShow(tx);
    return res.json({ transaction: refunded });
  }
  res.json({ transaction: tx });
}));

const noShowResolutionSchema = Joi.object({ outcome: Joi.string().valid('release', 'credit').required() });
linksRouter.post('/:id/transactions/:txId/no-show-resolution', validate(noShowResolutionSchema), asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, sellerId: req.sellerId });
  if (!link) throw new AppError(404, 'Link not found');
  const tx = await Transaction.findOne({ _id: req.params.txId, linkId: link._id });
  if (!tx) throw new AppError(404, 'Order not found');
  const updated = await resolveNonRefundableProductNoShow(tx, req.body.outcome);
  res.json({ transaction: updated });
}));

const evidenceSchema = Joi.object({
  text: Joi.string().max(2000).allow('').default(''),
  mediaUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
}).or('text', 'mediaUrl');

linksRouter.post('/:id/transactions/:txId/evidence', validate(evidenceSchema), asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, sellerId: req.sellerId });
  if (!link) throw new AppError(404, 'Link not found');
  const tx = await Transaction.findOne({ _id: req.params.txId, linkId: link._id, status: TX_STATUS.DISPUTED });
  if (!tx) throw new AppError(409, 'This order has no open dispute');
  tx.evidence.push({ submittedBy: req.sellerId, party: 'seller', text: req.body.text, mediaUrl: req.body.mediaUrl });
  await tx.save();
  res.json({ transaction: tx });
}));

// Turning a link off stops new checkouts. Orders already in progress
// keep resolving normally.
linksRouter.patch('/:id', validate(updateLinkSchema), asyncHandler(async (req, res) => {
  const link = await Link.findOne({ _id: req.params.id, sellerId: req.sellerId });
  if (!link) throw new AppError(404, 'Link not found');

  link.active = req.body.active;
  await link.save();
  res.json({ link });
}));
