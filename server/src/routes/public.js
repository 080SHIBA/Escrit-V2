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
import { Product } from '../models/Product.js';
import { Service } from '../models/Service.js';
import { notifyDisputeRaised } from '../services/notificationEvents.js';
import { recordFunnelEvent } from '../services/funnel.js';
import { publicSellerName } from '../utils/publicSellerName.js';
import { DEFAULT_RELEASE_WINDOW_HOURS } from '../../../shared/releaseConditions.js';

export const publicRouter = Router();
publicRouter.use(publicLimiter);

function linkTermsSnapshot(link) {
  return link.termsSnapshot || link.itemDescription || 'The seller will confirm delivery details with you before checkout.';
}

const PAYMENT_DEFAULTS = {
  both: { escrow: true, direct: true },
  escrow: { escrow: true, direct: false },
  direct: { escrow: false, direct: true },
};
const LISTING_MODELS = { product: Product, course: Course, service: Service };

async function paymentContextForLink(link, seller) {
  const Model = LISTING_MODELS[link.listingType];
  if (!Model || !link.listingId) return null;
  const listing = await Model.findById(link.listingId);
  if (!listing) return null;
  const paymentDefault = seller?.transactionPreferences?.paymentDefault || 'both';
  const paymentOptions = listing.overridesDefault
    ? listing.paymentOptions
    : PAYMENT_DEFAULTS[paymentDefault] || PAYMENT_DEFAULTS.both;
  const fulfilmentDefault = seller?.transactionPreferences?.fulfilmentDefault
    || seller?.onboarding?.fulfilmentDefault
    || 'delivery';
  const fulfilment = link.listingType === 'product'
    ? listing.fulfillmentOverridesDefault
      ? listing.fulfillmentMethod
      : fulfilmentDefault === 'both' ? 'delivery-or-pickup' : fulfilmentDefault
    : '';
  return { listing, paymentOptions, fulfilment };
}

function checkoutTermsSnapshot(link, paymentContext, checkoutMode) {
  const { paymentOptions, fulfilment } = paymentContext || {};
  const choice = checkoutMode === 'direct'
    ? 'Payment method: direct payment without escrow. Escrit cannot hold or recover this money, but buyers can still report problems.'
    : 'Payment method: Escrit escrow. Payment is held until the buyer confirms completion or the default release window ends.';
  const availability = paymentOptions?.escrow && paymentOptions?.direct
    ? 'This listing offers both options; the buyer selected one at checkout.'
    : paymentOptions?.escrow
      ? 'This listing accepts escrow payment only.'
      : paymentOptions?.direct
        ? 'This listing accepts payment without escrow only.'
        : '';
  return [link.itemName, linkTermsSnapshot(link), availability, choice, fulfilment ? `Fulfilment: ${fulfilment}.` : '']
    .filter(Boolean)
    .join('\n\n');
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
  const seller = await User.findById(link.sellerId).select('displayName businessName fullName isDemoSeed transactionPreferences onboarding.fulfilmentDefault');
  const paymentContext = await paymentContextForLink(link, seller);
  const paymentOptions = paymentContext?.paymentOptions;

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
      releaseWindowHours: link.releaseWindowHours ?? DEFAULT_RELEASE_WINDOW_HOURS,
      refundable: link.refundable,
      active: link.active,
      paymentOptions: paymentOptions || (link.fulfillmentType === 'service'
        ? { escrow: false, direct: true }
        : { escrow: true, direct: false }),
      paymentOptionLabel: paymentOptions
        ? paymentOptions.escrow && paymentOptions.direct ? 'Escrow optional' : paymentOptions.escrow ? 'Escrow only' : 'No escrow'
        : link.fulfillmentType === 'service' ? 'No escrow' : 'Escrow only',
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
  checkoutMode: Joi.string().valid('escrow', 'direct'),
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
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(401, 'Sign in to place an order');
  if (!buyer.fullName || !buyer.nin) throw new AppError(403, 'Complete your identity details in Profile settings before checkout');
  const seller = await User.findById(link.sellerId);
  if (seller?.isDemoSeed) throw new AppError(409, 'Demo listings are for browsing only and cannot accept real payment.');
  const paymentContext = await paymentContextForLink(link, seller);
  const paymentOptions = paymentContext?.paymentOptions
    || (link.fulfillmentType === 'service' ? { escrow: false, direct: true } : { escrow: true, direct: false });
  const checkoutMode = req.body.checkoutMode
    || (paymentOptions.escrow ? 'escrow' : 'direct');
  if (!paymentOptions[checkoutMode]) throw new AppError(409, 'This payment option is not available for this listing.');

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
    termsSnapshot: checkoutTermsSnapshot(link, paymentContext, checkoutMode),
    releaseWindowHours: link.releaseWindowHours ?? DEFAULT_RELEASE_WINDOW_HOURS,
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
  tx = await reconcileWithPaymentProvider(tx, req.app.get('io'));
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
      releaseWindowHours: tx.releaseWindowHours ?? link.releaseWindowHours ?? DEFAULT_RELEASE_WINDOW_HOURS,
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
  await notifyDisputeRaised({ io: req.app.get('io'), transaction: updated });
  res.json({ transaction: updated });
}));

const directComplaintSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required(),
});

publicRouter.post('/:linkId/t/:txId/complaint', requireAuth, validate(directComplaintSchema), asyncHandler(async (req, res) => {
  const tx = await loadTransaction(req);
  await assertBuyerOwnsTransaction(req, tx);
  if (![TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED].includes(tx.status)) {
    throw new AppError(409, 'Problems can be reported here after a direct payment is confirmed.');
  }
  if (tx.complaintLogged) throw new AppError(409, 'A problem report has already been submitted for this order.');
  tx.complaintLogged = true;
  tx.complaintReason = req.body.reason;
  tx.disputeRaisedAt = new Date();
  tx.evidence.push({
    submittedBy: req.sellerId,
    party: 'buyer',
    text: req.body.reason,
  });
  await tx.save();
  res.json({ transaction: tx });
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
