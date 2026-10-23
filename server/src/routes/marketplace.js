import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Course } from '../models/Course.js';
import { Service } from '../models/Service.js';
import { Review } from '../models/Review.js';
import { Link } from '../models/Link.js';
import { ProductCategory, CourseCategory, ServiceCategory } from '../models/ListingCategory.js';
import { AppError } from '../middleware/errorHandler.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { generateReference } from '../utils/reference.js';
import { initializeTransaction, quoteCollectionFee, getPaymentProviderName } from '../services/paymentProvider.js';
import { env } from '../config/env.js';
import { ensureCheckoutPrice } from '../services/pricing.js';
import { getPlatformSettings } from '../services/platformSettings.js';
import { PlatformCreditEntry } from '../models/PlatformCreditEntry.js';
import { ListingDraft } from '../models/ListingDraft.js';
import { SellerReport } from '../models/SellerReport.js';
import { publicSellerName, sanitizePublicSeller } from '../utils/publicSellerName.js';

export const marketplaceRouter = Router();
export const listingWorkflowRouter = Router();

const TYPE_CONFIG = {
  product: { Model: Product, Category: ProductCategory },
  course: { Model: Course, Category: CourseCategory },
  service: { Model: Service, Category: ServiceCategory },
};

const PAYMENT_OPTIONS = Object.freeze({
  both: Object.freeze({ escrow: true, direct: true }),
  escrow: Object.freeze({ escrow: true, direct: false }),
  direct: Object.freeze({ escrow: false, direct: true }),
});

function transactionPreferencesFor(user) {
  return {
    paymentDefault: user?.transactionPreferences?.paymentDefault || 'both',
    fulfilmentDefault: user?.transactionPreferences?.fulfilmentDefault
      || user?.onboarding?.fulfilmentDefault
      || 'delivery',
  };
}

function effectivePaymentOptions(listing, seller) {
  const defaults = transactionPreferencesFor(seller);
  return listing.overridesDefault
    ? listing.paymentOptions || PAYMENT_OPTIONS[defaults.paymentDefault]
    : PAYMENT_OPTIONS[defaults.paymentDefault] || PAYMENT_OPTIONS.both;
}

function effectiveFulfilment(listing, seller) {
  if (listing.fulfillmentOverridesDefault) return listing.fulfillmentMethod || listing.fulfillment || 'delivery';
  const defaultValue = transactionPreferencesFor(seller).fulfilmentDefault;
  return defaultValue === 'both' ? 'delivery-or-pickup' : defaultValue;
}

function paymentOptionLabel(options) {
  if (options.escrow && options.direct) return 'Escrow optional';
  return options.escrow ? 'Escrow only' : 'No escrow';
}

function transactionTermsSnapshot(listing, options, checkoutMode, fulfilment) {
  const paymentTerms = checkoutMode === 'escrow'
    ? 'Payment method: Escrit escrow. Funds are held until the buyer confirms completion or the order release window ends.'
    : 'Payment method: direct payment without escrow. Escrit cannot hold or recover this money, but buyers can still report problems.';
  const offerTerms = options.escrow && options.direct
    ? 'This listing offers both payment options; the buyer selected one at checkout.'
    : options.escrow
      ? 'This listing accepts escrow payment only.'
      : 'This listing accepts payment without escrow only.';
  return [listing.title, listing.description, paymentTerms, offerTerms, fulfilment ? `Fulfilment: ${fulfilment}.` : '']
    .filter(Boolean)
    .join('\n\n');
}

const publicListingsQuerySchema = Joi.object({
  q: Joi.string().trim().max(100).allow('').default(''),
  type: Joi.string().valid('all', 'product', 'course', 'service').default('all'),
  category: Joi.string().trim().max(80).allow('').default(''),
  cursor: Joi.number().integer().min(0).max(1000).default(0),
  limit: Joi.number().integer().min(1).max(100).default(6),
  sort: Joi.string().valid('newest', 'price-low', 'price-high', 'top-rated').default('newest'),
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicListing(item, type) {
  const seller = item.seller;
  if (seller) sanitizePublicSeller(seller);
  const paymentOptions = seller ? effectivePaymentOptions(item, seller) : item.paymentOptions || PAYMENT_OPTIONS.both;
  return {
    id: String(item._id),
    type,
    title: item.title,
    category: item.category,
    price: type === 'service' ? item.basePrice : item.price,
    coverUrl: item.images?.[0] || '',
    sellerId: seller?._id ? String(seller._id) : String(item.seller),
    sellerName: publicSellerName(seller),
    sellerVerified: seller?.kycStatus === 'verified',
    sellerAvatarUrl: seller?.profilePictureUrl || '',
    sellerRatingAvg: Number(seller?.averageRating || 0),
    sellerReviewCount: Number(seller?.reviewCount || 0),
    ratingAvg: Number(item.averageRating || 0),
    ratingCount: Number(item.reviewCount || 0),
    isFeatured: Boolean(item.isFeatured),
    paymentOptions,
    paymentOptionLabel: paymentOptionLabel(paymentOptions),
    fulfillmentMethod: seller ? effectiveFulfilment(item, seller) : item.fulfillmentMethod,
    createdAt: item.createdAt,
  };
}

async function loadListing(listingType, listingId) {
  const config = TYPE_CONFIG[listingType];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const item = await config.Model.findOne({ _id: listingId, isActive: true, isVerified: true })
    .populate('seller', 'businessName displayName fullName profilePictureUrl isDemoSeed transactionPreferences onboarding.fulfilmentDefault');
  if (item?.seller) sanitizePublicSeller(item.seller);
  if (!item) throw new AppError(404, 'Listing is no longer available');
  return item;
}

async function populateSavedItems(entries) {
  const listings = await Promise.all(entries.map(async (entry) => {
    try {
      const listing = await loadListing(entry.listingType, entry.listingId);
      return { entry, listing };
    } catch {
      return null;
    }
  }));
  const validListings = listings.filter(Boolean);
  const links = await Link.find({ _id: { $in: validListings.map(({ listing }) => listing.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const priceByLinkId = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));

  return validListings.map(({ entry, listing }) => ({
    listingType: entry.listingType,
    listing: {
      ...listing.toObject(),
      buyerPriceKobo: priceByLinkId.get(String(listing.escrowLinkId)) ?? null,
      paymentOptions: effectivePaymentOptions(listing, listing.seller),
      paymentOptionLabel: paymentOptionLabel(effectivePaymentOptions(listing, listing.seller)),
      fulfillmentMethod: entry.listingType === 'product'
        ? entry.fulfilment || effectiveFulfilment(listing, listing.seller)
        : undefined,
      paymentOption: entry.paymentOption || '',
      fulfilment: entry.fulfilment || '',
    },
    quantity: entry.quantity || 1,
  }));
}

const listingReferenceSchema = Joi.object({
  listingType: Joi.string().valid('product', 'course', 'service').required(),
  listingId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(10),
  paymentOption: Joi.string().valid('escrow', 'direct'),
  fulfilment: Joi.string().valid('delivery', 'pickup', 'delivery-or-pickup', 'digital-download', ''),
});
const cartQuantitySchema = Joi.object({ quantity: Joi.number().integer().min(1).max(100).required() });
const pricePreviewSchema = Joi.object({
  amount: Joi.number().min(100).max(100000000).required(),
  discountPercent: Joi.number().integer().min(1).max(90).optional(),
  startsAt: Joi.date().iso().optional(),
  endsAt: Joi.date().iso().optional(),
}).custom((value, helpers) => {
  if (value.discountPercent != null && (!value.startsAt || !value.endsAt || value.endsAt <= value.startsAt)) return helpers.error('any.invalid');
  return value;
});

marketplaceRouter.get('/price-preview', requireAuth, asyncHandler(async (req, res) => {
  const { error, value } = pricePreviewSchema.validate(req.query);
  if (error) throw new AppError(400, 'Enter a valid listing price to preview checkout');
  const basePriceKobo = Math.round(value.amount * 100);
  const now = new Date();
  const discountApplied = value.discountPercent != null && value.startsAt <= now && value.endsAt >= now;
  const effectivePriceKobo = discountApplied ? Math.max(10000, Math.round(basePriceKobo * (100 - value.discountPercent) / 100)) : basePriceKobo;
  const processingFeeKobo = await quoteCollectionFee(effectivePriceKobo);
  const { commissionPercent } = await getPlatformSettings();
  const commissionKobo = Math.floor(effectivePriceKobo * commissionPercent / 100);
  res.json({
    buyerPriceKobo: effectivePriceKobo + processingFeeKobo,
    sellerPayoutKobo: effectivePriceKobo - commissionKobo,
    discountApplied,
  });
}));

marketplaceRouter.get('/categories/:type', asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const categories = await config.Category.find({ isActive: true, approvalStatus: 'approved' }).sort({ name: 1 }).select('name slug');
  res.json({ categories });
}));

marketplaceRouter.get('/me/cart', requireAuth, asyncHandler(async (req, res) => {
 const buyer = await User.findById(req.sellerId);
 if (!buyer) throw new AppError(404, 'Account not found');
 const items = await populateSavedItems(buyer.cartItems);
  const totalKobo = items.reduce((sum, entry) => sum + Number(entry.listing.buyerPriceKobo || 0) * entry.quantity, 0);
  res.json({ items, subtotalKobo: totalKobo, totalKobo, feeQuoteAvailable: items.every((entry) => entry.listing.buyerPriceKobo != null) });
}));

marketplaceRouter.get('/me/orders', requireAuth, asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ buyerUserId: req.sellerId }).sort({ createdAt: -1 }).populate('linkId');
  res.json({ orders: transactions.filter((transaction) => transaction.linkId) });
}));

marketplaceRouter.get('/me/analytics', requireAuth, asyncHandler(async (req, res) => {
  const links = await Link.find({ sellerId: req.sellerId }).select('_id itemName listingType');
  const linkIds = links.map((link) => link._id);
  const transactions = await Transaction.find({ linkId: { $in: linkIds } }).sort({ createdAt: -1 });
  const linkById = new Map(links.map((link) => [String(link._id), link]));
  const paidStatuses = new Set([TX_STATUS.PAID_HELD, TX_STATUS.RELEASED, TX_STATUS.DISPUTED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.RESOLVED_REFUNDED, TX_STATUS.RESOLVED_CREDITED, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED]);
  const { commissionPercent } = await getPlatformSettings();
  const paid = transactions.filter((transaction) => paidStatuses.has(transaction.status));
  const grossPaidKobo = paid.reduce((sum, transaction) => sum + (transaction.buyerPriceKoboSnapshot || transaction.checkoutTotalKobo || 0) * (transaction.checkoutQuantity || 1), 0);
  const transactionAmountKobo = (transaction) => (transaction.checkoutTotalKobo ?? transaction.buyerPriceKoboSnapshot ?? 0) * (transaction.checkoutQuantity || 1);
  const awaitingPaymentKobo = transactions
    .filter((transaction) => transaction.status === TX_STATUS.CREATED)
    .reduce((sum, transaction) => sum + transactionAmountKobo(transaction), 0);
  const heldInEscrowKobo = transactions
    .filter((transaction) => [TX_STATUS.PAID_HELD, TX_STATUS.DISPUTED].includes(transaction.status))
    .reduce((sum, transaction) => sum + transactionAmountKobo(transaction), 0);
  const paidOutKobo = transactions
    .filter((transaction) => [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED].includes(transaction.status) && transaction.payoutState === 'completed')
    .reduce((sum, transaction) => {
      const payout = [...(transaction.payoutLog || [])].reverse()
        .find((entry) => entry.action === 'transfer_initiated');
      const detail = payout?.detail || {};
      if (Number.isFinite(detail.sellerBaseKobo) && Number.isFinite(detail.commissionKobo)) {
        return sum + detail.sellerBaseKobo - detail.commissionKobo;
      }
      const base = (transaction.sellerPayoutBaseKobo || 0) * (transaction.checkoutQuantity || 1);
      return sum + base - Math.floor(base * commissionPercent / 100);
    }, 0);
  const estimatedSellerPayoutKobo = paid.reduce((sum, transaction) => {
    const base = (transaction.sellerPayoutBaseKobo || 0) * (transaction.checkoutQuantity || 1);
    return sum + base - Math.floor(base * commissionPercent / 100);
  }, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const last30DaysPaid = paid.filter((transaction) => transaction.paidAt && new Date(transaction.paidAt) >= thirtyDaysAgo);
  const lastSevenDays = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - offset));
    const key = day.toISOString().slice(0, 10);
    const amountKobo = paid.filter((transaction) => transaction.paidAt && new Date(transaction.paidAt).toISOString().slice(0, 10) === key)
      .reduce((sum, transaction) => sum + (transaction.buyerPriceKoboSnapshot || transaction.checkoutTotalKobo || 0) * (transaction.checkoutQuantity || 1), 0);
    return { date: key, amountKobo };
  });
  const topListings = [...transactions.reduce((map, transaction) => {
    const link = linkById.get(String(transaction.linkId));
    if (!link) return map;
    const row = map.get(String(link._id)) || { linkId: String(link._id), title: link.itemName, listingType: link.listingType, orders: 0, grossPaidKobo: 0 };
    row.orders += 1;
    if (paidStatuses.has(transaction.status)) row.grossPaidKobo += (transaction.buyerPriceKoboSnapshot || transaction.checkoutTotalKobo || 0) * (transaction.checkoutQuantity || 1);
    map.set(String(link._id), row);
    return map;
  }, new Map()).values()].sort((left, right) => right.grossPaidKobo - left.grossPaidKobo).slice(0, 5);

  res.json({
    totalOrders: transactions.length,
    paidOrders: paid.length,
    grossPaidKobo,
    estimatedSellerPayoutKobo,
    financialSummary: { awaitingPaymentKobo, heldInEscrowKobo, paidOutKobo },
    last30Days: {
      orders: transactions.filter((transaction) => transaction.createdAt >= thirtyDaysAgo).length,
      grossPaidKobo: last30DaysPaid.reduce((sum, transaction) => sum + transactionAmountKobo(transaction), 0),
    },
    heldOrders: transactions.filter((transaction) => transaction.status === TX_STATUS.PAID_HELD).length,
    disputedOrders: transactions.filter((transaction) => transaction.status === TX_STATUS.DISPUTED).length,
    directSales: transactions.filter((transaction) => [TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED].includes(transaction.status)).length,
    lastSevenDays,
    topListings,
  });
}));

marketplaceRouter.get('/me/credits', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId).select('promoCreditsKobo');
  const entries = await PlatformCreditEntry.find({ userId: req.sellerId }).sort({ createdAt: -1 }).limit(50);
  res.json({ balanceKobo: user?.promoCreditsKobo || 0, entries });
}));

const creditSpendSchema = Joi.object({
  listingType: Joi.string().valid('product', 'course', 'service').required(),
  listingId: Joi.string().hex().length(24).required(),
  perk: Joi.string().valid('promote', 'feature').required(),
});

marketplaceRouter.post('/me/credits/spend', requireAuth, validate(creditSpendSchema), asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.body.listingType];
  const listing = await config.Model.findOne({ _id: req.body.listingId, seller: req.sellerId, isVerified: true });
  if (!listing) throw new AppError(404, 'Verified listing not found');
  const costs = { promote: 500000, feature: 1000000 };
  const amountKobo = costs[req.body.perk];
  const user = await User.findOneAndUpdate(
    { _id: req.sellerId, promoCreditsKobo: { $gte: amountKobo } },
    { $inc: { promoCreditsKobo: -amountKobo } },
    { new: true }
  );
  if (!user) throw new AppError(409, 'You do not have enough promotion credits for this perk');

  if (req.body.perk === 'feature') {
    listing.isFeatured = true;
  } else {
    listing.promotionUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  await listing.save();
  await PlatformCreditEntry.create({
    userId: req.sellerId,
    type: 'spent',
    amountKobo: -amountKobo,
    reason: req.body.perk === 'feature' ? 'Featured listing promotion' : 'Listing promotion placement',
    listingId: listing._id,
    listingType: req.body.listingType,
  });
  res.json({ balanceKobo: user.promoCreditsKobo, listing });
}));

marketplaceRouter.get('/me/listings', requireAuth, asyncHandler(async (req, res) => {
  const groups = await Promise.all(Object.entries(TYPE_CONFIG).map(async ([listingType, { Model }]) => {
    const items = await Model.find({ seller: req.sellerId }).sort({ updatedAt: -1 });
    return items.map((item) => ({ ...item.toObject(), listingType }));
  }));
  res.json({ listings: groups.flat() });
}));

const listingUpdateSchema = Joi.object({
  active: Joi.boolean(),
  paymentOptions: Joi.object({
    escrow: Joi.boolean().required(),
    direct: Joi.boolean().required(),
  }),
  overridesDefault: Joi.boolean(),
  fulfillmentMethod: Joi.string().valid('delivery', 'pickup', 'delivery-or-pickup', 'digital-download'),
  fulfillmentOverridesDefault: Joi.boolean(),
}).min(1);
marketplaceRouter.patch('/me/listings/:type/:id', requireAuth, validate(listingUpdateSchema), asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const [item, seller] = await Promise.all([
    config.Model.findOne({ _id: req.params.id, seller: req.sellerId }),
    User.findById(req.sellerId),
  ]);
  if (!item) throw new AppError(404, 'Listing not found');
  if (!seller) throw new AppError(404, 'Seller not found');
  if (req.body.active !== undefined) item.isActive = req.body.active;
  if (req.body.paymentOptions !== undefined || req.body.overridesDefault !== undefined) {
    const overridesDefault = req.body.overridesDefault
      ?? (req.body.paymentOptions !== undefined ? true : item.overridesDefault);
    const paymentOptions = effectivePaymentOptions({
      overridesDefault,
      paymentOptions: req.body.paymentOptions || item.paymentOptions,
    }, seller);
    if (!paymentOptions || (!paymentOptions.escrow && !paymentOptions.direct)) {
      throw new AppError(400, 'Choose at least one payment option.');
    }
    item.paymentOptions = paymentOptions;
    item.overridesDefault = overridesDefault;
  }
  if (req.params.type === 'product' && (req.body.fulfillmentMethod !== undefined || req.body.fulfillmentOverridesDefault !== undefined)) {
    item.fulfillmentOverridesDefault = req.body.fulfillmentOverridesDefault
      ?? (req.body.fulfillmentMethod !== undefined ? true : item.fulfillmentOverridesDefault);
    item.fulfillmentMethod = item.fulfillmentOverridesDefault
      ? req.body.fulfillmentMethod || item.fulfillmentMethod
      : effectiveFulfilment({}, seller);
  }
  await item.save();
  res.json({ item });
}));

const cartCheckoutSchema = Joi.object({
  checkoutMode: Joi.string().valid('escrow', 'direct').default('escrow'),
});

marketplaceRouter.post('/me/cart/checkout', requireAuth, validate(cartCheckoutSchema), asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  if (!buyer.fullName || !buyer.nin) throw new AppError(403, 'Complete your identity details in Profile settings before checkout');
  const items = await populateSavedItems(buyer.cartItems);
  if (!items.length) throw new AppError(409, 'Your cart is empty');
  const checkoutMode = req.body.checkoutMode;
  if (items.some((entry) => !entry.listing.paymentOptions[checkoutMode === 'escrow' ? 'escrow' : 'direct'])) {
    throw new AppError(409, 'The selected payment option is not available for every listing in your cart.');
  }

  const checkoutLines = items.map(({ listingType, listing, quantity }) => ({
    listingType,
    quantity: listingType === 'product' ? quantity : 1,
    linkId: listing.escrowLinkId,
    paymentOptions: listing.paymentOptions,
    listing,
    fulfillmentMethod: listing.fulfillmentMethod,
  }));
  if (checkoutLines.some((line) => !line.linkId)) throw new AppError(409, 'A cart listing is missing its escrow checkout');

  for (const line of checkoutLines) {
    if (line.listingType === 'product' && line.quantity > line.listing.stock) {
      throw new AppError(409, `${line.listing.title} no longer has enough stock`);
    }
  }

  const links = await Link.find({ _id: { $in: checkoutLines.map((line) => line.linkId) }, active: true });
  const linkById = new Map(links.map((link) => [String(link._id), link]));
  if (links.length !== checkoutLines.length) throw new AppError(409, 'A cart listing is no longer available for checkout');
  if (await User.exists({ _id: { $in: links.map((link) => link.sellerId) }, isDemoSeed: true })) {
    throw new AppError(409, 'Demo listings are for browsing only and cannot accept real payment.');
  }

  await Promise.all(links.map(ensureCheckoutPrice));
  const chargeTotalKobo = checkoutLines.reduce((sum, line) => {
    const link = linkById.get(String(line.linkId));
    if (link.checkoutPriceKobo == null) throw new AppError(503, 'The all-inclusive checkout price is temporarily unavailable');
    return sum + link.checkoutPriceKobo * line.quantity;
  }, 0);
  const reference = generateReference('escrit-cart');
  const firstLine = checkoutLines[0];
  const paymentProvider = await getPaymentProviderName();
  const transactions = await Transaction.create(checkoutLines.map((line) => ({
    linkId: line.linkId,
    paymentProvider,
    paymentReference: reference,
    checkoutTotalKobo: chargeTotalKobo,
    buyerPriceKoboSnapshot: linkById.get(String(line.linkId)).checkoutPriceKobo,
    sellerPayoutBaseKobo: linkById.get(String(line.linkId)).checkoutBasePriceKobo ?? linkById.get(String(line.linkId)).priceKobo,
    buyerUserId: buyer._id,
    buyerEmail: buyer.email,
    checkoutQuantity: line.quantity,
    checkoutMode,
    termsAcceptedAt: new Date(),
    termsSnapshot: transactionTermsSnapshot(line.listing, line.paymentOptions, checkoutMode, line.fulfillmentMethod),
  })));

  try {
    const payment = await initializeTransaction({
      email: buyer.email,
      amountKobo: chargeTotalKobo,
      reference,
      callbackUrl: `${env.clientOrigins[0]}/r/${firstLine.linkId}/t/${transactions[0].id}/result`,
      metadata: { transactionIds: transactions.map((transaction) => transaction.id), buyerId: buyer.id },
    });
    await Promise.all(transactions.map(async (transaction) => {
      transaction.paymentProviderTransactionId = payment.id ? String(payment.id) : null;
      await transaction.save();
    }));
    res.json({ authorizationUrl: payment.authorization_url, reference, transactionId: transactions[0].id, totalKobo: chargeTotalKobo });
  } catch (error) {
    await Transaction.deleteMany({ _id: { $in: transactions.map((transaction) => transaction._id) } });
    throw error;
  }
}));

marketplaceRouter.post('/me/cart', requireAuth, validate(listingReferenceSchema), asyncHandler(async (req, res) => {
  const { listingType, listingId, paymentOption, fulfilment } = req.body;
  const listing = await loadListing(listingType, listingId);
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const existing = buyer.cartItems.find((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
  const quantity = listingType === 'product'
    ? req.body.quantity ?? (existing?.quantity || 0) + 1
    : 1;
  const paymentOptions = effectivePaymentOptions(listing, listing.seller);
  if (paymentOption && !paymentOptions[paymentOption]) throw new AppError(409, 'That payment option is not available for this listing.');
  if (listingType === 'product' && quantity > listing.stock) throw new AppError(409, 'That quantity is no longer in stock');
  const selectedFulfilment = listingType === 'product'
    ? fulfilment || effectiveFulfilment(listing, listing.seller)
    : '';
  if (existing) {
    existing.quantity = quantity;
    if (paymentOption) existing.paymentOption = paymentOption;
    if (selectedFulfilment) existing.fulfilment = selectedFulfilment;
  } else {
    buyer.cartItems.push({
      listingType,
      listingId,
      quantity,
      paymentOption: paymentOption || (paymentOptions.escrow ? 'escrow' : 'direct'),
      fulfilment: selectedFulfilment,
    });
  }
  if (existing && !existing.paymentOption) existing.paymentOption = paymentOptions.escrow ? 'escrow' : 'direct';
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.cartItems) });
}));

marketplaceRouter.patch('/me/cart/:listingType/:listingId', requireAuth, validate(cartQuantitySchema), asyncHandler(async (req, res) => {
  const { listingType, listingId } = req.params;
  if (listingType !== 'product') throw new AppError(409, 'Only product quantities can be changed.');
  const { quantity } = req.body;
  const listing = await loadListing(listingType, listingId);
  if (listingType === 'product' && quantity > listing.stock) throw new AppError(409, 'That quantity is no longer in stock');
  const buyer = await User.findById(req.sellerId);
  const existing = buyer?.cartItems.find((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
  if (!existing) throw new AppError(404, 'Cart item not found');
  existing.quantity = quantity;
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.cartItems) });
}));

marketplaceRouter.delete('/me/cart/:listingType/:listingId', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  buyer.cartItems = buyer.cartItems.filter((entry) => !(entry.listingType === req.params.listingType && String(entry.listingId) === req.params.listingId));
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.cartItems) });
}));

marketplaceRouter.get('/me/favorites', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  res.json({ items: await populateSavedItems(buyer.favoriteListings) });
}));

marketplaceRouter.post('/me/favorites', requireAuth, validate(listingReferenceSchema), asyncHandler(async (req, res) => {
  const { listingType, listingId } = req.body;
  await loadListing(listingType, listingId);
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const exists = buyer.favoriteListings.some((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
  if (!exists) buyer.favoriteListings.push({ listingType, listingId });
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.favoriteListings) });
}));

marketplaceRouter.delete('/me/favorites/:listingType/:listingId', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  buyer.favoriteListings = buyer.favoriteListings.filter((entry) => !(entry.listingType === req.params.listingType && String(entry.listingId) === req.params.listingId));
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.favoriteListings) });
}));

const scheduledDiscountSchema = Joi.object({
  percent: Joi.number().integer().min(1).max(90).required(),
  startsAt: Joi.date().iso().required(),
  endsAt: Joi.date().iso().required(),
}).custom((discount, helpers) => new Date(discount.endsAt) > new Date(discount.startsAt) ? discount : helpers.error('any.invalid'));

const createListingSchema = Joi.object({
  title: Joi.string().min(3).max(120).required(),
  description: Joi.string().max(2000).allow('').optional(),
  category: Joi.string().max(80).default('General'),
  images: Joi.array().items(Joi.string().uri().allow('')).default([]),
  price: Joi.number().min(0).default(0),
  stock: Joi.number().min(0).default(1),
  condition: Joi.string().valid('new', 'used', 'refurbished').default('new'),
  fulfillmentMethod: Joi.string().valid('delivery', 'pickup', 'delivery-or-pickup', 'digital-download'),
  paymentOptions: Joi.object({
    escrow: Joi.boolean().required(),
    direct: Joi.boolean().required(),
  }).default({ escrow: true, direct: true }),
  overridesDefault: Joi.boolean().default(false),
  fulfillmentOverridesDefault: Joi.boolean().default(false),
  negotiable: Joi.boolean().default(false),
  refundable: Joi.boolean().default(false),
  deliveryOptions: Joi.array().items(Joi.object({
    method: Joi.string().valid('pickup', 'seller_delivery').required(),
    fee: Joi.number().min(0).default(0),
    details: Joi.string().max(240).allow('').default(''),
  })).unique('method').max(2).default([{ method: 'pickup', fee: 0 }]),
  deliveryFormat: Joi.string().valid('self-paced', 'live').default('self-paced'),
  format: Joi.string().valid('self-paced-videos', 'live-cohort', 'pdf-ebook'),
  level: Joi.string().valid('beginner', 'intermediate', 'advanced'),
  duration: Joi.string().max(120).allow('').default(''),
  curriculum: Joi.array().items(Joi.object({
    title: Joi.string().trim().min(1).max(120).required(),
    description: Joi.string().max(1000).allow('').default(''),
    videoUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
  })).max(40).default([]),
  scheduledDiscount: scheduledDiscountSchema.allow(null).default(null),
  refundable: Joi.boolean().default(false),
  refundConditions: Joi.string().allow('').default(''),
  basePrice: Joi.number().min(0).default(0),
  pricingUnit: Joi.string().default('project'),
  estimatedTime: Joi.string().default('1-2 weeks'),
  location: Joi.string().default('Remote'),
  deliveryMode: Joi.string().valid('remote', 'in-person', 'hybrid').default('remote'),
  serviceRadiusKm: Joi.number().min(0).max(1000).default(0),
  durationMinutes: Joi.number().integer().min(15).max(1440).default(60),
  bookingLeadTimeHours: Joi.number().integer().min(0).max(8760).default(24),
  maxBookingsPerDay: Joi.number().integer().min(1).max(100).default(4),
  timeZone: Joi.string().max(80).default('Africa/Lagos'),
  availability: Joi.array().items(Joi.object({
    day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
  })).unique('day').max(7).default([]),
  deliverables: Joi.array().items(Joi.string().max(160)).max(30).default([]),
  requirements: Joi.array().items(Joi.string().max(160)).max(30).default([]),
  cancellationPolicy: Joi.string().valid('flexible', 'moderate', 'strict', 'custom').default('moderate'),
  cancellationTerms: Joi.string().max(1000).allow('').default(''),
  reschedulePolicy: Joi.string().max(500).allow('').default(''),
});

async function ensureCategory(type, name, requestedBy) {
  const { Category } = TYPE_CONFIG[type];
  const categoryName = String(name || 'General').trim();
  if (!categoryName) return { name: 'General', approved: true };

  const normalized = categoryName.toLowerCase();
  const existing = await Category.findOne({ slug: normalized });
  if (existing?.approvalStatus === 'rejected') {
    existing.approvalStatus = 'pending';
    existing.requestedBy = requestedBy;
    await existing.save();
  }
  if (existing) return { name: existing.name, approved: existing.approvalStatus === 'approved' };

  if (normalized === 'general') return { name: 'General', approved: true };
  const created = await Category.create({ name: categoryName, slug: normalized, approvalStatus: 'pending', requestedBy });
  return { name: created.name, approved: false };
}

async function createMarketplaceListing(type, body, sellerId) {
  const config = TYPE_CONFIG[type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const seller = await User.findById(sellerId);
  if (!seller) throw new AppError(404, 'Seller not found');
  if (seller.kycStatus !== 'verified') throw new AppError(422, 'Complete identity verification in Profile & KYC before listing');

  const paymentOptions = body.overridesDefault
    ? body.paymentOptions
    : PAYMENT_OPTIONS[transactionPreferencesFor(seller).paymentDefault];
  if (!paymentOptions || (!paymentOptions.escrow && !paymentOptions.direct)) {
    throw new AppError(400, 'Choose at least one payment option.');
  }
  const fulfillmentMethod = body.fulfillmentOverridesDefault
    ? body.fulfillmentMethod
    : effectiveFulfilment({}, seller);
  const priceNaira = type === 'service' ? Number(body.basePrice || 0) : Number(body.price || 0);
  if (priceNaira < 100) throw new AppError(422, 'Marketplace listings must be priced at ₦100 or more.');

  const categoryResult = await ensureCategory(type, body.category, seller._id);
  const payload = {
    ...body,
    seller: seller._id,
    category: categoryResult.name,
    categoryReviewStatus: categoryResult.approved ? 'approved' : 'pending',
    images: Array.isArray(body.images) ? body.images : [],
    paymentOptions,
    overridesDefault: Boolean(body.overridesDefault),
    fulfillmentOverridesDefault: Boolean(body.fulfillmentOverridesDefault),
  };
  if (type === 'product') {
    payload.price = Number(body.price || 0);
    payload.stock = Number(body.stock || 1);
    payload.fulfillmentMethod = fulfillmentMethod;
    payload.deliveryOptions = fulfillmentMethod === 'delivery'
      ? [{ method: 'seller_delivery', fee: 0 }]
      : fulfillmentMethod === 'pickup'
        ? [{ method: 'pickup', fee: 0 }]
        : fulfillmentMethod === 'delivery-or-pickup'
          ? [{ method: 'seller_delivery', fee: 0 }, { method: 'pickup', fee: 0 }]
          : [{ method: 'pickup', fee: 0 }];
  }
  if (type === 'course') {
    payload.price = Number(body.price || 0);
    payload.curriculum = body.curriculum?.length
      ? body.curriculum
      : [{ title: 'Course overview', description: body.description || '', videoUrl: '' }];
    if (body.refundable && !body.refundConditions) throw new AppError(400, 'Refund conditions are required when refundable is true');
  }
  if (type === 'service') payload.basePrice = Number(body.basePrice || 0);

  const item = await config.Model.create(payload);
  let link;
  try {
    link = await Link.create({
      sellerId: seller._id,
      itemName: item.title,
      itemDescription: type === 'course' && item.refundable
        ? `${item.description || ''}\n\nRefund conditions: ${item.refundConditions}`.trim()
        : item.description,
      fulfillmentType: type,
      listingType: type,
      listingId: item._id,
      refundable: Boolean(item.refundable),
      scheduledDiscount: ['product', 'course'].includes(type) ? body.scheduledDiscount : null,
      itemPhotoUrl: item.images[0] || null,
      priceKobo: Math.round(priceNaira * 100),
      checkoutPriceKobo: null,
      checkoutBasePriceKobo: null,
    });
    item.escrowLinkId = link._id;
    await item.save();
  } catch (error) {
    await Promise.all([
      config.Model.deleteOne({ _id: item._id }),
      link ? Link.deleteOne({ _id: link._id }) : Promise.resolve(),
    ]);
    throw error;
  }
  return item;
}

const listingDraftSchema = Joi.object({
  status: Joi.string().valid('draft', 'live').default('draft'),
  type: Joi.string().valid('product', 'service', 'course').required(),
  title: Joi.string().max(80).allow('').default(''),
  category: Joi.string().max(80).allow('').default(''),
  description: Joi.string().max(1000).allow('').default(''),
  price: Joi.number().min(0).default(0),
  images: Joi.array().items(Joi.string().uri({ scheme: ['https'] })).max(5).default([]),
  allowOffers: Joi.boolean().default(false),
  condition: Joi.string().valid('new', 'used').default('new'),
  fulfillment: Joi.string().valid('delivery', 'pickup', 'delivery-or-pickup', 'digital-download').default('delivery'),
  paymentOptions: Joi.object({
    escrow: Joi.boolean().required(),
    direct: Joi.boolean().required(),
  }).default({ escrow: true, direct: true }),
  overridesDefault: Joi.boolean().default(false),
  fulfillmentOverridesDefault: Joi.boolean().default(false),
  quantity: Joi.number().integer().min(1).max(100000).default(1),
  deliveryTime: Joi.string().max(120).allow('').default(''),
  format: Joi.string().valid('self-paced-videos', 'live-cohort', 'pdf-ebook').default('self-paced-videos'),
  level: Joi.string().valid('beginner', 'intermediate', 'advanced').default('beginner'),
  duration: Joi.string().max(120).allow('').default(''),
}).unknown(false);

function validatePublishableListing(listing) {
  if (listing.title.trim().length < 5) throw new AppError(400, 'Add a title with at least 5 characters.');
  if (!listing.category) throw new AppError(400, 'Choose a category.');
  if (listing.price <= 0) throw new AppError(400, 'Enter a price above zero.');
  if (listing.overridesDefault && !listing.paymentOptions.escrow && !listing.paymentOptions.direct) {
    throw new AppError(400, 'Choose at least one payment option.');
  }
  if (['product', 'course'].includes(listing.type) && listing.images.length < 1) throw new AppError(400, 'Add at least one photo.');
  if (listing.type === 'service' && !listing.deliveryTime.trim()) throw new AppError(400, 'Add an estimated service delivery time.');
  if (listing.type === 'course' && !listing.duration.trim()) throw new AppError(400, 'Add a course duration or number of lessons.');
}

function marketplacePayload(listing) {
  const common = {
    title: listing.title,
    category: listing.category,
    description: listing.description,
    images: listing.images,
    paymentOptions: listing.paymentOptions,
    overridesDefault: listing.overridesDefault,
    fulfillmentOverridesDefault: listing.fulfillmentOverridesDefault,
  };
  if (listing.type === 'product') {
    const deliveryOptions = listing.fulfillment === 'delivery'
      ? [{ method: 'seller_delivery', fee: 0 }]
      : listing.fulfillment === 'pickup'
        ? [{ method: 'pickup', fee: 0 }]
        : listing.fulfillment === 'delivery-or-pickup'
          ? [{ method: 'seller_delivery', fee: 0 }, { method: 'pickup', fee: 0 }]
          : [{ method: 'pickup', fee: 0 }];
    return {
      ...common,
      price: listing.price,
      stock: listing.quantity,
      condition: listing.condition,
      fulfillmentMethod: listing.fulfillment,
      fulfillmentOverridesDefault: listing.fulfillmentOverridesDefault,
      deliveryOptions,
      negotiable: listing.allowOffers,
    };
  }
  if (listing.type === 'service') {
    return { ...common, basePrice: listing.price, estimatedTime: listing.deliveryTime };
  }
  return {
    ...common,
    price: listing.price,
    format: listing.format,
    level: listing.level,
    duration: listing.duration,
    deliveryFormat: listing.format === 'live-cohort' ? 'live' : 'self-paced',
    curriculum: [{ title: 'Course overview', description: listing.description, videoUrl: '' }],
  };
}

listingWorkflowRouter.get('/', asyncHandler(async (req, res) => {
  const { error, value } = publicListingsQuerySchema.validate(req.query);
  if (error) throw new AppError(400, 'Enter valid listing filters.');

  const filter = { isActive: true, isVerified: true };
  if (value.category) filter.category = new RegExp(`^${escapeRegex(value.category)}$`, 'i');
  if (value.q) {
    const term = new RegExp(escapeRegex(value.q), 'i');
    filter.$or = [{ title: term }, { description: term }, { category: term }];
  }

  const types = value.type === 'all' ? Object.keys(TYPE_CONFIG) : [value.type];
  const pageSize = value.cursor + value.limit + 1;
  const groups = await Promise.all(types.map(async (type) => {
    const { Model } = TYPE_CONFIG[type];
    const items = await Model.find(filter)
      .sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1, _id: -1 })
      .limit(pageSize)
      .populate('seller', 'businessName displayName fullName profilePictureUrl kycStatus averageRating reviewCount transactionPreferences onboarding.fulfilmentDefault')
      .lean();
    return items.map((item) => publicListing(item, type));
  }));

  const compare = (left, right) => {
    if (value.sort === 'price-low') return left.price - right.price;
    if (value.sort === 'price-high') return right.price - left.price;
    if (value.sort === 'top-rated') {
      return right.ratingAvg - left.ratingAvg || right.ratingCount - left.ratingCount;
    }
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  };
  const ordered = groups.flat().sort(compare);
  const items = ordered.slice(value.cursor, value.cursor + value.limit);
  const hasMore = ordered.length > value.cursor + items.length;

  res.json({
    items,
    nextCursor: hasMore ? String(value.cursor + items.length) : null,
  });
}));

async function findPublicListing(id) {
  if (!/^[\da-f]{24}$/i.test(id)) throw new AppError(400, 'Enter a valid listing id.');
  for (const [type, { Model }] of Object.entries(TYPE_CONFIG)) {
    const item = await Model.findById(id)
      .populate('seller', 'businessName displayName fullName profilePictureUrl bio city kycStatus averageRating reviewCount transactionPreferences onboarding.fulfilmentDefault');
    if (!item) continue;
    if (!item.isActive || !item.isVerified || item.categoryReviewStatus === 'pending') {
      throw new AppError(410, 'Listing is no longer available');
    }
    if (item.seller) sanitizePublicSeller(item.seller);
    return { item, type };
  }
  throw new AppError(404, 'Listing not found');
}

async function publicListingDetail(item, type) {
  const seller = item.seller;
  const paymentOptions = effectivePaymentOptions(item, seller);
  const liveListingCount = seller?._id
    ? await Promise.all(Object.values(TYPE_CONFIG).map(({ Model }) =>
      Model.countDocuments({ seller: seller._id, isActive: true, isVerified: true, categoryReviewStatus: 'approved' })
    )).then((counts) => counts.reduce((sum, count) => sum + count, 0))
    : 0;
  const common = {
    id: String(item._id),
    _id: String(item._id),
    type,
    title: item.title,
    description: item.description || '',
    category: item.category || 'General',
    price: type === 'service' ? item.basePrice : item.price,
    coverUrl: item.images?.[0] || '',
    gallery: item.images || [],
    images: item.images || [],
    ratingAvg: Number(item.averageRating || 0),
    ratingCount: Number(item.reviewCount || 0),
    sellerRatingAvg: Number(seller?.averageRating || 0),
    sellerReviewCount: Number(seller?.reviewCount || 0),
    sellerId: String(seller?._id || item.seller),
    sellerName: publicSellerName(seller),
    sellerVerified: seller?.kycStatus === 'verified',
    sellerAvatarUrl: seller?.profilePictureUrl || '',
    paymentOptions,
    paymentOptionLabel: paymentOptionLabel(paymentOptions),
    active: true,
    isActive: true,
    refundable: Boolean(item.refundable),
    refundConditions: item.refundConditions || '',
    createdAt: item.createdAt,
    seller: {
      id: String(seller?._id || item.seller),
      displayName: publicSellerName(seller),
      avatarUrl: seller?.profilePictureUrl || '',
      bio: seller?.bio || '',
      isVerified: seller?.kycStatus === 'verified',
      ratingAvg: Number(seller?.averageRating || 0),
      ratingCount: Number(seller?.reviewCount || 0),
      liveListingCount,
    },
  };
  if (type === 'product') {
    return {
      ...common,
      stock: item.stock,
      condition: item.condition,
      fulfillmentMethod: effectiveFulfilment(item, seller),
      deliveryOptions: (item.deliveryOptions || []).map((option) => ({
        method: option.method === 'seller_delivery' ? 'delivery' : option.method,
        fee: option.fee,
        details: option.details,
      })),
      area: seller?.city || '',
      negotiable: Boolean(item.negotiable),
    };
  }
  if (type === 'course') {
    return {
      ...common,
      format: item.format,
      deliveryFormat: item.deliveryFormat,
      level: item.level,
      duration: item.duration,
      accessMethod: item.format === 'pdf-ebook' ? 'Digital download' : item.deliveryFormat === 'live' ? 'Live course access' : 'Self-paced course access',
      curriculum: (item.curriculum || []).map(({ title, description }) => ({ title, description })),
    };
  }
  return {
    ...common,
    basePrice: item.basePrice,
    pricingUnit: item.pricingUnit,
    deliveryTime: item.estimatedTime,
    estimatedTime: item.estimatedTime,
    coordination: item.deliveryMode === 'in-person' ? 'In person' : item.deliveryMode === 'hybrid' ? 'Remote or in person' : 'Remote',
    scheduling: 'Timing agreed in Escrit chat',
    deliveryMode: item.deliveryMode,
    location: item.location,
    durationMinutes: item.durationMinutes,
    bookingLeadTimeHours: item.bookingLeadTimeHours,
    timeZone: item.timeZone,
    availability: item.availability,
    included: item.deliverables || [],
    deliverables: item.deliverables || [],
    requirements: item.requirements || [],
    howItWorks: [
      'Agree the service scope and timing with the seller in Escrit chat.',
      'The seller completes the agreed work.',
      'Confirm completion if you selected escrow.',
    ],
    cancellationPolicy: item.cancellationPolicy,
    cancellationTerms: item.cancellationTerms,
    reschedulePolicy: item.reschedulePolicy,
    seller: common.seller,
  };
}

listingWorkflowRouter.get('/:id/reviews', asyncHandler(async (req, res) => {
  const { item, type } = await findPublicListing(req.params.id);
  const [reviews, aggregates] = await Promise.all([
    Review.find({ listingType: type, listingId: item._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('rating comment createdAt'),
    Review.aggregate([
      { $match: { listingType: type, listingId: item._id } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(aggregates.map(({ _id, count }) => [Number(_id), count]));
  const total = aggregates.reduce((sum, entry) => sum + entry.count, 0);
  res.json({
    reviews: reviews.map((review) => ({
      id: String(review._id),
      rating: review.rating,
      comment: review.comment,
      completedOrder: true,
      createdAt: review.createdAt,
    })),
    ratingDistribution: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: counts.get(rating) || 0,
      percentage: total ? Number(((counts.get(rating) || 0) / total * 100).toFixed(1)) : 0,
    })),
  });
}));

listingWorkflowRouter.get('/:id/related', asyncHandler(async (req, res) => {
  const { item, type } = await findPublicListing(req.params.id);
  const sellerId = item.seller?._id;
  const query = {
    _id: { $ne: item._id },
    isActive: true,
    isVerified: true,
    categoryReviewStatus: 'approved',
    $or: [
      { category: item.category },
      ...(sellerId ? [{ seller: sellerId }] : []),
    ],
  };
  const groups = await Promise.all(Object.entries(TYPE_CONFIG).map(async ([listingType, { Model }]) => {
    const entries = await Model.find(query)
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(8)
      .populate('seller', 'businessName displayName fullName profilePictureUrl kycStatus averageRating reviewCount transactionPreferences onboarding.fulfilmentDefault');
    return entries.map((entry) => publicListing(entry, listingType));
  }));
  const candidates = groups.flat().sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  const sameSeller = candidates.filter((entry) => entry.sellerId === String(sellerId)).slice(0, 3);
  res.json({
    items: candidates.slice(0, 4),
    sellerListings: sameSeller,
    seller: (await publicListingDetail(item, type)).seller,
  });
}));

listingWorkflowRouter.get('/:id', asyncHandler(async (req, res, next) => {
  if (req.params.id === 'draft') return next();
  const { item, type } = await findPublicListing(req.params.id);
  res.json({ listing: await publicListingDetail(item, type) });
}));

listingWorkflowRouter.use(requireAuth);
listingWorkflowRouter.get('/draft', asyncHandler(async (req, res) => {
  const draft = await ListingDraft.findOne({ seller: req.sellerId });
  res.json({ draft });
}));
listingWorkflowRouter.post('/', asyncHandler(async (req, res) => {
  const { error, value } = listingDraftSchema.validate(req.body, { abortEarly: false });
  if (error) throw new AppError(400, 'Check the listing details and try again.');
  if (value.status === 'draft') {
    const draft = await ListingDraft.findOneAndUpdate(
      { seller: req.sellerId },
      { ...value, seller: req.sellerId },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ draft });
  }
  validatePublishableListing(value);
  const item = await createMarketplaceListing(value.type, marketplacePayload(value), req.sellerId);
  await ListingDraft.deleteOne({ seller: req.sellerId });
  res.status(201).json({ item, listingType: value.type });
}));
listingWorkflowRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { error, value } = listingDraftSchema.validate(req.body, { abortEarly: false });
  if (error) throw new AppError(400, 'Check the listing details and try again.');
  if (value.status !== 'draft') throw new AppError(400, 'Published listings cannot be changed as drafts.');
  const draft = await ListingDraft.findOneAndUpdate(
    { _id: req.params.id, seller: req.sellerId },
    { ...value },
    { new: true, runValidators: true }
  );
  if (!draft) throw new AppError(404, 'Draft not found. Save again to create a new draft.');
  res.json({ draft });
}));

marketplaceRouter.get('/overview', asyncHandler(async (_req, res) => {
  const [products, courses, services, reviews] = await Promise.all([
    Product.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).limit(4).populate('seller', 'businessName displayName fullName isDemoSeed transactionPreferences onboarding.fulfilmentDefault'),
    Course.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).limit(4).populate('seller', 'businessName displayName fullName isDemoSeed transactionPreferences onboarding.fulfilmentDefault'),
    Service.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).limit(4).populate('seller', 'businessName displayName fullName isDemoSeed transactionPreferences onboarding.fulfilmentDefault'),
    Review.find({ comment: { $ne: '' } }).sort({ createdAt: -1 }).limit(6).populate('buyerId', 'businessName').populate('sellerId', 'businessName displayName fullName'),
  ]);

  const allItems = [...products, ...courses, ...services];
  allItems.forEach((item) => sanitizePublicSeller(item.seller));
  reviews.forEach((review) => sanitizePublicSeller(review.sellerId));
  const links = await Link.find({ _id: { $in: allItems.map((item) => item.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const checkoutPriceById = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));
  for (const item of allItems) {
    const options = effectivePaymentOptions(item, item.seller);
    item.set('buyerPriceKobo', checkoutPriceById.get(String(item.escrowLinkId)) || null, { strict: false });
    item.set('paymentOptions', options, { strict: false });
    item.set('paymentOptionLabel', paymentOptionLabel(options), { strict: false });
    item.set('fulfillmentMethod', effectiveFulfilment(item, item.seller), { strict: false });
  }

  res.json({
    products,
    courses,
    services,
    reviews,
    counts: {
      products: products.length,
      courses: courses.length,
      services: services.length,
    },
  });
}));

marketplaceRouter.get('/seller/:sellerId', asyncHandler(async (req, res) => {
  const seller = await User.findById(req.params.sellerId).select('businessName displayName fullName profilePictureUrl bio city createdAt kycStatus onboarding.fulfilmentDefault transactionPreferences isDemoSeed');
  if (!seller) throw new AppError(404, 'Seller not found');
  const [products, courses, services] = await Promise.all([
    Product.find({ seller: seller._id, isActive: true, isVerified: true, categoryReviewStatus: 'approved' }).sort({ createdAt: -1 }),
    Course.find({ seller: seller._id, isActive: true, isVerified: true, categoryReviewStatus: 'approved' }).sort({ createdAt: -1 }),
    Service.find({ seller: seller._id, isActive: true, isVerified: true, categoryReviewStatus: 'approved' }).sort({ createdAt: -1 }),
  ]);
  const listings = [
    ...products.map((item) => ({ ...item.toObject(), listingType: 'product' })),
    ...courses.map((item) => ({ ...item.toObject(), listingType: 'course' })),
    ...services.map((item) => ({ ...item.toObject(), listingType: 'service' })),
  ];
  const links = await Link.find({ _id: { $in: listings.map((item) => item.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const checkoutPriceById = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));
  const reviewStats = await Review.aggregate([
    { $match: { sellerId: seller._id } },
    { $lookup: { from: Transaction.collection.name, localField: 'transactionId', foreignField: '_id', as: 'transaction' } },
    { $unwind: '$transaction' },
    {
      $match: {
        $or: [
          { listingType: 'service', 'transaction.status': { $in: [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_COMPLETED] } },
          { listingType: { $in: ['product', 'course'] }, 'transaction.status': { $in: [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED] } },
        ],
      },
    },
    { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  const stats = reviewStats[0] || { averageRating: 0, reviewCount: 0 };
  const publicName = publicSellerName(seller);
  res.json({
    seller: {
      _id: seller._id,
      displayName: publicName,
      profilePictureUrl: seller.profilePictureUrl,
      bio: seller.bio,
      city: seller.city,
      createdAt: seller.createdAt,
      identityVerified: seller.kycStatus === 'verified',
      fulfilmentDefault: transactionPreferencesFor(seller).fulfilmentDefault,
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount,
    },
    listings: listings.map((item) => {
      const options = effectivePaymentOptions(item, seller);
      return {
        ...item,
        buyerPriceKobo: checkoutPriceById.get(String(item.escrowLinkId)) ?? null,
        paymentOptions: options,
        paymentOptionLabel: paymentOptionLabel(options),
        fulfillmentMethod: item.listingType === 'product' ? effectiveFulfilment(item, seller) : undefined,
      };
    }),
  });
}));

const sellerReportSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(1000).required(),
});

marketplaceRouter.post('/seller/:sellerId/report', requireAuth, validate(sellerReportSchema), asyncHandler(async (req, res) => {
  if (!/^[\da-f]{24}$/i.test(req.params.sellerId)) throw new AppError(400, 'Enter a valid seller id');
  if (String(req.params.sellerId) === String(req.sellerId)) throw new AppError(400, 'You cannot report your own storefront');
  const sellerExists = await User.exists({ _id: req.params.sellerId });
  if (!sellerExists) throw new AppError(404, 'Seller not found');
  const report = await SellerReport.create({
    sellerId: req.params.sellerId,
    reporterId: req.sellerId,
    reason: req.body.reason,
  });
  res.status(201).json({ ok: true, reportId: report.id });
}));

marketplaceRouter.get('/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const config = TYPE_CONFIG[type];
  if (!config) {
    return res.status(400).json({ error: 'Unsupported listing type' });
  }

  const items = await config.Model.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).populate('seller', 'businessName displayName fullName profilePictureUrl isDemoSeed transactionPreferences onboarding.fulfilmentDefault');
  items.forEach((item) => sanitizePublicSeller(item.seller));
  const links = await Link.find({ _id: { $in: items.map((item) => item.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const checkoutPriceById = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));
  for (const item of items) {
    const options = effectivePaymentOptions(item, item.seller);
    item.set('buyerPriceKobo', checkoutPriceById.get(String(item.escrowLinkId)) || null, { strict: false });
    item.set('paymentOptions', options, { strict: false });
    item.set('paymentOptionLabel', paymentOptionLabel(options), { strict: false });
    item.set('fulfillmentMethod', effectiveFulfilment(item, item.seller), { strict: false });
  }
  res.json({ items });
}));

marketplaceRouter.get('/:type/:id', asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const item = await config.Model.findOne({ _id: req.params.id, isActive: true, isVerified: true }).populate('seller', 'businessName displayName fullName profilePictureUrl bio isDemoSeed transactionPreferences onboarding.fulfilmentDefault');
  if (!item) throw new AppError(404, 'Listing not found');
  if (item.seller) sanitizePublicSeller(item.seller);
  const link = item.escrowLinkId ? await Link.findById(item.escrowLinkId) : null;
  const buyerPriceKobo = link ? await ensureCheckoutPrice(link) : null;
  const paymentOptions = effectivePaymentOptions(item, item.seller);
  res.json({ item: {
    ...item.toObject(),
    buyerPriceKobo,
    paymentOptions,
    paymentOptionLabel: paymentOptionLabel(paymentOptions),
    fulfillmentMethod: req.params.type === 'product' ? effectiveFulfilment(item, item.seller) : undefined,
  } });
}));

const directCheckoutSchema = Joi.object({
  checkoutMode: Joi.string().valid('escrow', 'direct').default('direct'),
  appointmentAt: Joi.date().iso().allow(null).default(null),
});

marketplaceRouter.post('/:type/:id/checkout', requireAuth, validate(directCheckoutSchema), asyncHandler(async (req, res) => {
  const listingType = req.params.type;
  const config = TYPE_CONFIG[listingType];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const listing = await config.Model.findOne({ _id: req.params.id, isActive: true, isVerified: true });
  if (!listing) throw new AppError(404, 'Listing is no longer available');
  const buyer = await User.findById(req.sellerId);
  if (!buyer?.fullName || !buyer.nin) throw new AppError(403, 'Complete your identity details in Profile settings before checkout');
  const seller = await User.findById(listing.seller);
  const paymentOptions = effectivePaymentOptions(listing, seller);
  const checkoutMode = req.body.checkoutMode;
  if (!paymentOptions[checkoutMode]) throw new AppError(409, 'This payment option is not available for this listing.');
  if (checkoutMode === 'direct' && !seller?.bankAccount) throw new AppError(409, 'This seller is not ready to receive payment yet');
  if (seller?.isDemoSeed) throw new AppError(409, 'Demo listings are for browsing only and cannot accept real payment.');
  const link = await Link.findOne({ listingType, listingId: listing._id, active: true });
  if (!link) throw new AppError(409, 'Direct checkout is not available for this listing');
  const priceKobo = listingType === 'service' ? link.priceKobo : Math.round(listing.price * 100);
  if (!Number.isFinite(priceKobo) || priceKobo < 10000) throw new AppError(409, 'This listing does not have a checkout price');
  const buyerPriceKobo = await ensureCheckoutPrice(link);
  if (buyerPriceKobo == null) throw new AppError(503, 'The all-inclusive checkout price is temporarily unavailable');

  const reference = generateReference(`escrit-${listingType}`);
  const transaction = await Transaction.create({
    linkId: link._id,
    paymentProvider: await getPaymentProviderName(),
    paymentReference: reference,
    checkoutMode,
    checkoutTotalKobo: buyerPriceKobo,
    buyerPriceKoboSnapshot: buyerPriceKobo,
    sellerPayoutBaseKobo: link.checkoutBasePriceKobo ?? link.priceKobo,
    buyerUserId: buyer._id,
    buyerEmail: buyer.email,
    termsAcceptedAt: new Date(),
    termsSnapshot: transactionTermsSnapshot(
      listing,
      paymentOptions,
      checkoutMode,
      listingType === 'product' ? effectiveFulfilment(listing, seller) : '',
    ),
    fulfillmentNote: req.body.appointmentAt ? `Requested appointment: ${req.body.appointmentAt.toISOString()}` : '',
  });
  try {
    const payment = await initializeTransaction({
      email: buyer.email,
      amountKobo: buyerPriceKobo,
      reference,
      callbackUrl: `${env.clientOrigins[0]}/r/${link.id}/t/${transaction.id}/result`,
      metadata: { transactionId: transaction.id, listingType, listingId: listing.id, checkoutMode },
    });
    transaction.paymentProviderTransactionId = payment.id ? String(payment.id) : null;
    await transaction.save();
    res.json({ authorizationUrl: payment.authorization_url, transactionId: transaction.id, totalKobo: buyerPriceKobo });
  } catch (error) {
    await Transaction.deleteOne({ _id: transaction._id });
    throw error;
  }
}));

marketplaceRouter.get('/:type/:id/reviews', asyncHandler(async (req, res) => {
  if (!TYPE_CONFIG[req.params.type]) throw new AppError(400, 'Unsupported listing type');
  const reviews = await Review.find({ listingType: req.params.type, listingId: req.params.id })
    .sort({ createdAt: -1 })
    .populate('buyerId', 'businessName profilePictureUrl');
  res.json({ reviews });
}));

marketplaceRouter.get('/me/review-eligibility/:type/:id', requireAuth, asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const listing = await config.Model.findById(req.params.id).select('escrowLinkId');
  if (!listing?.escrowLinkId) return res.json({ eligible: false });
  const transactions = await Transaction.find({
    linkId: listing.escrowLinkId,
    buyerUserId: req.sellerId,
    status: { $in: req.params.type === 'service'
      ? [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_COMPLETED]
      : [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED] },
  }).select('_id').sort({ createdAt: 1 });
  const reviewedIds = new Set((await Review.find({ transactionId: { $in: transactions.map((entry) => entry._id) } }).select('transactionId')).map((entry) => String(entry.transactionId)));
  const transaction = transactions.find((entry) => !reviewedIds.has(String(entry._id)));
  res.json({ eligible: Boolean(transaction), transactionId: transaction?._id || null });
}));

const reviewSchema = Joi.object({
  transactionId: Joi.string().hex().length(24).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).allow('').default(''),
});

marketplaceRouter.post('/:type/:id/reviews', requireAuth, validate(reviewSchema), asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const listing = await config.Model.findById(req.params.id);
  if (!listing?.escrowLinkId) throw new AppError(404, 'Listing not found');
  const transaction = await Transaction.findOne({
    _id: req.body.transactionId,
    linkId: listing.escrowLinkId,
    buyerUserId: req.sellerId,
    status: { $in: req.params.type === 'service'
      ? [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_COMPLETED]
      : [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED] },
  });
  if (!transaction) throw new AppError(403, 'Only a buyer with a completed order can review this listing');
  if (await Review.exists({ transactionId: transaction._id })) throw new AppError(409, 'You have already reviewed this order');

  const review = await Review.create({
    listingType: req.params.type,
    listingId: listing._id,
    sellerId: listing.seller,
    buyerId: req.sellerId,
    transactionId: transaction._id,
    rating: req.body.rating,
    comment: req.body.comment,
  });
  const listingCount = listing.reviewCount || 0;
  listing.averageRating = ((listing.averageRating || 0) * listingCount + review.rating) / (listingCount + 1);
  listing.reviewCount = listingCount + 1;
  await listing.save();

  const seller = await User.findById(listing.seller);
  if (seller) {
    const sellerCount = seller.reviewCount || 0;
    seller.averageRating = ((seller.averageRating || 0) * sellerCount + review.rating) / (sellerCount + 1);
    seller.reviewCount = sellerCount + 1;
    await seller.save();
  }
  res.status(201).json({ review });
}));

marketplaceRouter.post('/:type', requireAuth, validate(createListingSchema), asyncHandler(async (req, res) => {
  const item = await createMarketplaceListing(req.params.type, req.body, req.sellerId);
  res.status(201).json({ item });
}));
