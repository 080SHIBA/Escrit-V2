// Buyer-facing routes, no login required: view the item and seller's public
// display name, pay, then confirm or dispute. Routes never write escrow
// status themselves; that goes through services/escrow.js.
//
// A link is shared by all buyers. Each checkout creates its own
// Transaction, and status, confirmation and disputes are scoped to it.
import { Router } from 'express';
import Joi from 'joi';
import { Link } from '../models/Link.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { publicLimiter } from '../middleware/rateLimit.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { initializeTransaction, getPaymentProviderName } from '../services/paymentProvider.js';
import { releaseOnBuyerConfirmation, raiseDispute, reconcileWithPaymentProvider, refundServiceNoShow } from '../services/escrow.js';
import { generateReference } from '../utils/reference.js';
import { env } from '../config/env.js';
import { ensureCheckoutPrice } from '../services/pricing.js';
import { Course } from '../models/Course.js';
import { recordFunnelEvent } from '../services/funnel.js';
import { publicSellerName } from '../utils/publicSellerName.js';

export const publicRouter = Router();
publicRouter.use(publicLimiter);

function linkTermsSnapshot(link) {
  return link.termsSnapshot || link.itemDescription || 'The seller will confirm delivery details with you before checkout.';
}

async function loadLink(req) {
  const link = await Link.findById(req.params.linkId);
  if (!link) throw new AppError(404, 'This payment link does not exist');
  return link;
}

async function loadTransaction(req) {
  const tx = await Transaction.findOne({ _id: req.params.txId, linkId: req.params.linkId });
  if (!tx) throw new AppError(404, 'This order does not exist');
  return tx;
}

// The item and the seller's public identity. Bank and legal identity details
// are never exposed, and no single buyer's status appears here.
publicRouter.get('/:linkId', asyncHandler(async (req, res) => {
  const link = await loadLink(req);
  const checkoutPriceKobo = await ensureCheckoutPrice(link);
  const seller = await User.findById(link.sellerId).select('displayName businessName fullName isDemoSeed');

  res.json({
    link: {
      id: link.id,
      itemName: link.itemName,
      itemDescription: link.itemDescription,
      termsSnapshot: linkTermsSnapshot(link),
      itemPhotoUrl: link.itemPhotoUrl,
      priceKobo: link.priceKobo,
      checkoutPriceKobo,
      fulfillmentType: link.fulfillmentType,
      refundable: link.refundable,
      active: link.active,
    },
    seller: {
      id: String(seller._id),
      displayName: publicSellerName(seller),
      businessName: publicSellerName(seller),
      demoOnly: Boolean(seller.isDemoSeed),
    },
  });
}));

const checkoutSchema = Joi.object({
  phone: Joi.string().allow('').default(''),
  termsAccepted: Joi.boolean().valid(true).required(),
});

// Starts a new order (Transaction) and hands the buyer to Flutterwave.
// The link itself is unchanged and keeps accepting other buyers.
publicRouter.post('/:linkId/checkout', requireAuth, validate(checkoutSchema), asyncHandler(async (req, res) => {
  const link = await loadLink(req);
  if (!link.active) {
    throw new AppError(409, 'This link is no longer accepting payment');
  }
  if (link.expiresAt && link.expiresAt <= new Date()) {
    throw new AppError(410, 'This payment link has expired');
  }
    const checkoutMode = link.fulfillmentType === 'service' ? 'direct' : 'escrow';

  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(401, 'Sign in to place an order');
  if (!buyer.fullName || !buyer.nin) throw new AppError(403, 'Complete your identity details in Profile settings before checkout');
  const seller = await User.findById(link.sellerId).select('isDemoSeed');
  if (seller?.isDemoSeed) throw new AppError(409, 'Demo listings are for browsing only and cannot accept real payment.');

  const reference = generateReference('escrit');
  const checkoutTotalKobo = await ensureCheckoutPrice(link);
  if (checkoutTotalKobo == null) throw new AppError(503, 'The all-inclusive checkout price is temporarily unavailable');
  const tx = await Transaction.create({
    linkId: link._id,
    paymentProvider: await getPaymentProviderName(),
    paymentReference: reference,
      checkoutMode,
    checkoutTotalKobo,
    buyerPriceKoboSnapshot: checkoutTotalKobo,
    sellerPayoutBaseKobo: link.checkoutBasePriceKobo ?? link.priceKobo,
    buyerUserId: buyer._id,
    buyerEmail: buyer.email,
    buyerPhone: req.body.phone || null,
    termsAcceptedAt: new Date(),
    termsSnapshot: linkTermsSnapshot(link),
  });
  recordFunnelEvent('terms_accepted', {
    userId: buyer._id,
    linkId: String(link._id),
    transactionId: String(tx._id),
  }).catch((error) => console.error('[funnel] could not record terms_accepted', error.message));

  const flutterwaveTx = await initializeTransaction({
    email: buyer.email,
    amountKobo: checkoutTotalKobo,
    reference: tx.paymentReference,
    callbackUrl: `${env.clientOrigins[0]}/r/${link.id}/t/${tx.id}/result`,
    metadata: { linkId: link.id, transactionId: tx.id },
  });

  tx.paymentProviderTransactionId = flutterwaveTx.id ? String(flutterwaveTx.id) : null;
  await tx.save();

  res.json({ authorizationUrl: flutterwaveTx.authorization_url, reference: tx.paymentReference, transactionId: tx.id });
}));

// One buyer's order: its status plus the item details. The buyer's
// browser polls this after paying.
publicRouter.get('/:linkId/t/:txId', requireAuth, asyncHandler(async (req, res) => {
  const link = await loadLink(req);
  const checkoutPriceKobo = await ensureCheckoutPrice(link);
  let tx = await loadTransaction(req);
  await assertBuyerOwnsTransaction(req, tx);
  tx = await reconcileWithPaymentProvider(tx);
  const seller = await User.findById(link.sellerId);
  const courseAccess = [TX_STATUS.PAID_HELD, TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_PAID].includes(tx.status) && link.fulfillmentType === 'course' && link.listingId
    ? await Course.findById(link.listingId).select('curriculum deliveryFormat')
    : null;

  res.json({
    link: {
      id: link.id,
      itemName: link.itemName,
      itemDescription: link.itemDescription,
      termsSnapshot: tx.termsSnapshot || linkTermsSnapshot(link),
      itemPhotoUrl: link.itemPhotoUrl,
      priceKobo: link.priceKobo,
      checkoutPriceKobo,
      fulfillmentType: link.fulfillmentType,
      refundable: link.refundable,
    },
    seller: {
      id: String(seller._id),
      businessName: seller.displayName || seller.businessName,
      demoOnly: Boolean(seller.isDemoSeed),
    },
    courseAccess,
    transaction: tx,
  });
}));

async function assertBuyerOwnsTransaction(req, tx) {
  if (tx.buyerUserId && String(tx.buyerUserId) !== String(req.sellerId)) {
    throw new AppError(403, 'This order belongs to another buyer account');
  }
  if (!tx.buyerUserId) {
    const buyer = await User.findById(req.sellerId).select('email');
    if (!buyer || buyer.email.toLowerCase() !== String(tx.buyerEmail || '').toLowerCase()) {
      throw new AppError(403, 'This order belongs to another buyer account');
    }
  }
}

publicRouter.post('/:linkId/t/:txId/confirm-receipt', requireAuth, asyncHandler(async (req, res) => {
  const tx = await loadTransaction(req);
  await assertBuyerOwnsTransaction(req, tx);
  const updated = await releaseOnBuyerConfirmation(tx);
  res.json({ transaction: updated });
}));

const disputeSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required(),
  evidenceText: Joi.string().max(2000).allow('').default(''),
  evidenceUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
});

publicRouter.post('/:linkId/t/:txId/dispute', requireAuth, validate(disputeSchema), asyncHandler(async (req, res) => {
  const tx = await loadTransaction(req);
  await assertBuyerOwnsTransaction(req, tx);
  const updated = await raiseDispute(tx, req.body.reason, { text: req.body.evidenceText, mediaUrl: req.body.evidenceUrl });
  res.json({ transaction: updated });
}));

const evidenceSchema = Joi.object({
  text: Joi.string().max(2000).allow('').default(''),
  mediaUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
}).or('text', 'mediaUrl');

publicRouter.post('/:linkId/t/:txId/evidence', requireAuth, validate(evidenceSchema), asyncHandler(async (req, res) => {
  const tx = await loadTransaction(req);
  await assertBuyerOwnsTransaction(req, tx);
  if (tx.status !== TX_STATUS.DISPUTED) throw new AppError(409, 'Evidence can only be added while a dispute is open');
  tx.evidence.push({ submittedBy: req.sellerId, party: 'buyer', text: req.body.text, mediaUrl: req.body.mediaUrl });
  await tx.save();
  res.json({ transaction: tx });
}));

const noShowReasonSchema = Joi.object({ reason: Joi.string().trim().min(5).max(500).required() });
publicRouter.post('/:linkId/t/:txId/no-show-reason', requireAuth, validate(noShowReasonSchema), asyncHandler(async (req, res) => {
  const tx = await loadTransaction(req);
  await assertBuyerOwnsTransaction(req, tx);
  const updated = await refundServiceNoShow(tx, req.body.reason);
  res.json({ transaction: updated });
}));
