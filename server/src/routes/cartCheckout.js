import { Router } from 'express';
import Joi from 'joi';
import { createHash } from 'node:crypto';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { User } from '../models/User.js';
import { Link } from '../models/Link.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { CheckoutAttempt } from '../models/CheckoutAttempt.js';
import { Product } from '../models/Product.js';
import { Course } from '../models/Course.js';
import { Service } from '../models/Service.js';
import {
  effectivePaymentOptions,
  effectiveFulfilment,
  loadListing,
  populateSavedItems,
  publicListing,
  transactionTermsSnapshot,
} from './marketplace.js';
import { ensureCheckoutPrice } from '../services/pricing.js';
import { getPaymentProviderName, initializeTransaction } from '../services/paymentProvider.js';
import { reconcileWithPaymentProvider } from '../services/escrow.js';
import { env } from '../config/env.js';
import { generateReference } from '../utils/reference.js';

export const cartCheckoutRouter = Router();
cartCheckoutRouter.use('/cart', requireAuth);
cartCheckoutRouter.use('/checkout', requireAuth);
cartCheckoutRouter.use('/me/recently-viewed', requireAuth);
cartCheckoutRouter.use('/listings/similar', requireAuth);

const listingTypes = ['product', 'course', 'service'];
// WHAT: which listing types may go in the cart.
// WHY only products: courses and services are bought immediately (a course grants access on
// payment; a service needs its own scheduling and requirements). Grouping them in a cart made
// no sense. Removal still accepts every type so old cart entries can be cleared.
const cartListingTypes = ['product'];
const instantListingTypes = ['course'];
const listingIdSchema = Joi.string().hex().length(24);
const cartPatchSchema = Joi.object({
  deliveryAddress: Joi.string().trim().max(500).allow(''),
  item: Joi.object({
    listingType: Joi.string().valid(...cartListingTypes).required(),
    listingId: listingIdSchema.required(),
    quantity: Joi.number().integer().min(1).max(10),
    paymentOption: Joi.string().valid('escrow', 'direct'),
    fulfilment: Joi.string().valid('delivery', 'pickup', 'delivery-or-pickup', 'digital-download', ''),
  }).min(3),
}).min(1);
const orderChoiceSchema = Joi.object({
  listingType: Joi.string().valid(...cartListingTypes).required(),
  listingId: listingIdSchema.required(),
  quantity: Joi.number().integer().min(1).max(10).required(),
  paymentOption: Joi.string().valid('escrow', 'direct').required(),
  fulfilment: Joi.string().valid('delivery', 'pickup', 'delivery-or-pickup', 'digital-download', '').default(''),
});
const checkoutSchema = Joi.object({
  idempotencyKey: Joi.string().trim().min(8).max(120).required(),
  termsAccepted: Joi.boolean().valid(true).required(),
  deliveryAddress: Joi.string().trim().max(500).allow('').default(''),
  orders: Joi.array().items(orderChoiceSchema).min(1).max(50).unique((a, b) => a.listingType === b.listingType && a.listingId === b.listingId).required(),
});
const recentSchema = Joi.object({
  listingType: Joi.string().valid(...cartListingTypes).required(),
  listingId: listingIdSchema.required(),
});

async function getCartResponse(buyer) {
  // WHY drop non-products: carts saved before this rule may hold courses; they are removed quietly.
  const productAndCourseItems = buyer.cartItems.filter((entry) => entry.listingType === 'product');
  if (productAndCourseItems.length !== buyer.cartItems.length) {
    buyer.cartItems = productAndCourseItems;
    await buyer.save();
  }
  const items = await populateSavedItems(productAndCourseItems);
  const subtotalKobo = items.reduce(
    (sum, entry) => sum + Number(entry.listing.checkoutBasePriceKobo ?? entry.listing.buyerPriceKobo ?? 0) * entry.quantity,
    0,
  );
  const totalKobo = items.reduce(
    (sum, entry) => sum + Number(entry.listing.buyerPriceKobo || 0) * entry.quantity,
    0,
  );
  return {
    items,
    deliveryAddress: buyer.cartDeliveryAddress || '',
    subtotalKobo,
    processingFeeKobo: totalKobo - subtotalKobo,
    totalKobo,
    feeQuoteAvailable: items.every((entry) => entry.listing.buyerPriceKobo != null),
  };
}

cartCheckoutRouter.get('/cart', asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  res.json(await getCartResponse(buyer));
}));

cartCheckoutRouter.post('/cart', validate(Joi.object({
  listingType: Joi.string().valid(...cartListingTypes).required(),
  listingId: listingIdSchema.required(),
  quantity: Joi.number().integer().min(1).max(10),
  paymentOption: Joi.string().valid('escrow', 'direct'),
  fulfilment: Joi.string().valid('delivery', 'pickup', 'delivery-or-pickup', 'digital-download', ''),
})), asyncHandler(async (req, res) => {
  const { listingType, listingId, paymentOption, fulfilment } = req.body;
  const listing = await loadListing(listingType, listingId);
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const existing = buyer.cartItems.find((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
  const quantity = listingType === 'product' ? req.body.quantity ?? (existing?.quantity || 0) + 1 : 1;
  const paymentOptions = effectivePaymentOptions(listing, listing.seller);
  if (paymentOption && !paymentOptions[paymentOption]) throw new AppError(409, 'That payment option is not available for this listing.');
  if (listingType === 'product' && quantity > listing.stock) throw new AppError(409, 'That quantity is no longer in stock');
  const offeredFulfilment = effectiveFulfilment(listing, listing.seller);
  const fulfilmentOptions = offeredFulfilment === 'delivery-or-pickup'
    ? ['delivery', 'pickup']
    : [offeredFulfilment];
  // WHAT: turn what the client sent into one concrete method (delivery or pickup).
  // WHY: listings that offer both are described as 'delivery-or-pickup'. The marketplace
  // card used to send that label as if it were a choice, and the check below rejected it
  // because the allowed choices are only 'delivery' and 'pickup'. Those listings therefore
  // could never be added from the card. A combined label now means "no preference yet",
  // so we fall back to the default (delivery) and the buyer can change it in the cart.
  const requestedFulfilment = fulfilment === 'delivery-or-pickup' ? '' : fulfilment;
  const fulfilmentChoice = listingType === 'product'
    ? requestedFulfilment || (offeredFulfilment === 'delivery-or-pickup' ? 'delivery' : offeredFulfilment)
    : '';
  if (listingType === 'product' && !fulfilmentOptions.includes(fulfilmentChoice)) {
    throw new AppError(409, 'That fulfilment option is not available for this listing.');
  }
  if (existing) {
    existing.quantity = quantity;
    if (paymentOption) existing.paymentOption = paymentOption;
    if (fulfilmentChoice) existing.fulfilment = fulfilmentChoice;
  } else {
    buyer.cartItems.push({
      listingType,
      listingId,
      quantity,
      paymentOption: paymentOption || (paymentOptions.escrow ? 'escrow' : 'direct'),
      fulfilment: fulfilmentChoice,
    });
  }
  await buyer.save();
  res.json(await getCartResponse(buyer));
}));

cartCheckoutRouter.patch('/cart', validate(cartPatchSchema), asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  if (req.body.deliveryAddress !== undefined) buyer.cartDeliveryAddress = req.body.deliveryAddress;

  if (req.body.item) {
    const { listingType, listingId, quantity, paymentOption, fulfilment } = req.body.item;
    const cartItem = buyer.cartItems.find((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
    if (!cartItem) throw new AppError(404, 'Cart item not found');
    const listing = await loadListing(listingType, listingId);
    const paymentOptions = effectivePaymentOptions(listing, listing.seller);
    if (paymentOption && !paymentOptions[paymentOption]) throw new AppError(409, 'That payment option is not available for this listing.');
    if (listingType === 'product' && quantity !== undefined && quantity > listing.stock) {
      throw new AppError(409, 'That quantity is no longer in stock');
    }
    if (quantity !== undefined) cartItem.quantity = listingType === 'product' ? quantity : 1;
    if (paymentOption) cartItem.paymentOption = paymentOption;
    if (fulfilment !== undefined) {
      const offered = effectiveFulfilment(listing, listing.seller);
      const validFulfilments = offered === 'delivery-or-pickup' ? ['delivery', 'pickup'] : [offered];
      if (listingType === 'product' && !validFulfilments.includes(fulfilment)) {
        throw new AppError(409, 'That fulfilment option is not available for this listing.');
      }
      cartItem.fulfilment = fulfilment;
    }
  }

  await buyer.save();
  res.json(await getCartResponse(buyer));
}));

cartCheckoutRouter.delete('/cart/:listingType/:listingId', asyncHandler(async (req, res) => {
  if (!listingTypes.includes(req.params.listingType) || !/^[\da-f]{24}$/i.test(req.params.listingId)) {
    throw new AppError(400, 'Enter a valid cart listing');
  }
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  buyer.cartItems = buyer.cartItems.filter((entry) => !(entry.listingType === req.params.listingType && String(entry.listingId) === req.params.listingId));
  await buyer.save();
  res.json(await getCartResponse(buyer));
}));

async function buildReview(buyer, choices, deliveryAddress, itemsOverride) {
  // WHY itemsOverride: instant purchases (courses) review a single item that never enters the cart.
  const savedItems = await populateSavedItems(itemsOverride || buyer.cartItems);
  if (!savedItems.length) throw new AppError(409, 'Your cart is empty');
  const links = await Link.find({
    _id: { $in: savedItems.map(({ listing }) => listing.escrowLinkId).filter(Boolean) },
    active: true,
  });
  if (links.length !== savedItems.length) throw new AppError(409, 'A cart listing is no longer available for checkout.');
  const linkById = new Map(links.map((link) => [String(link._id), link]));
  const choiceByKey = new Map(choices.map((choice) => [`${choice.listingType}:${choice.listingId}`, choice]));
  const lines = [];

  for (const entry of savedItems) {
    const listing = entry.listing;
    const listingId = String(listing._id);
    const key = `${entry.listingType}:${listingId}`;
    // WHAT: the payment options that really apply (seller default + type rules).
    // WHY not listing.paymentOptions: that raw field ignores the seller's account-level default
    // and the "courses never use escrow" rule, so checkout could accept a payment method the
    // listing page never offered.
    const allowedPayment = effectivePaymentOptions(listing, listing.seller);
    const choice = choiceByKey.get(key) || {
      listingType: entry.listingType,
      listingId,
      quantity: entry.quantity,
      paymentOption: entry.paymentOption || (allowedPayment.escrow ? 'escrow' : 'direct'),
      fulfilment: entry.fulfilment || '',
    };
    if (!allowedPayment[choice.paymentOption]) {
      throw new AppError(409, `The selected payment method is no longer available for ${listing.title}.`);
    }
    const quantity = entry.listingType === 'product' ? choice.quantity : 1;
    if (quantity > 10 || (entry.listingType === 'product' && quantity > listing.stock)) {
      throw new AppError(409, `${listing.title} no longer has that quantity in stock.`);
    }
    const availableFulfilment = listing.fulfillmentMethod || effectiveFulfilment(listing, listing.seller);
    const fulfillmentOptions = availableFulfilment === 'delivery-or-pickup' ? ['delivery', 'pickup'] : [availableFulfilment];
    const fulfillment = entry.listingType === 'product'
      ? choice.fulfilment || fulfillmentOptions[0]
      : '';
    if (entry.listingType === 'product' && !fulfillmentOptions.includes(fulfillment)) {
      throw new AppError(409, `The selected fulfilment method is no longer available for ${listing.title}.`);
    }
    const basePriceKobo = Number(listing.checkoutBasePriceKobo ?? listing.buyerPriceKobo ?? 0);
    const buyerPriceKobo = Number(listing.buyerPriceKobo ?? 0);
    if (!basePriceKobo || !buyerPriceKobo) throw new AppError(503, 'The payment fee is temporarily unavailable. Try again shortly.');
    if (entry.listingType === 'product' && fulfillment === 'delivery' && deliveryAddress.trim().length < 10) {
      throw new AppError(400, 'Enter a delivery address of at least 10 characters.');
    }
    const link = linkById.get(String(listing.escrowLinkId));
    const releaseWindowHours = link.releaseWindowHours;
    lines.push({
      listingType: entry.listingType,
      listingId,
      listing,
      quantity,
      paymentOption: choice.paymentOption,
      fulfilment: fulfillment,
      basePriceKobo,
      buyerPriceKobo,
      processingFeeKobo: buyerPriceKobo - basePriceKobo,
      lineTotalKobo: buyerPriceKobo * quantity,
      releaseWindowHours,
      termsSnapshot: transactionTermsSnapshot(listing, allowedPayment, choice.paymentOption, fulfillment, releaseWindowHours),
    });
  }

  const selectedKeys = new Set(lines.map((line) => `${line.listingType}:${line.listingId}`));
  if (choices.some((choice) => !selectedKeys.has(`${choice.listingType}:${choice.listingId}`))) {
    throw new AppError(409, 'Your cart changed. Review it again before paying.');
  }
  return {
    lines,
    subtotalKobo: lines.reduce((sum, line) => sum + line.basePriceKobo * line.quantity, 0),
    processingFeeKobo: lines.reduce((sum, line) => sum + line.processingFeeKobo * line.quantity, 0),
    totalKobo: lines.reduce((sum, line) => sum + line.lineTotalKobo, 0),
    requiresDeliveryAddress: lines.some((line) => line.listingType === 'product' && line.fulfilment === 'delivery'),
    deliveryAddress: deliveryAddress.trim(),
  };
}

function reviewResponse(review) {
  return {
    orders: review.lines.map((line) => ({
      listingType: line.listingType,
      listingId: line.listingId,
      title: line.listing.title,
      seller: line.listing.seller?.displayName || line.listing.seller?.businessName || 'Escrit seller',
      quantity: line.quantity,
      paymentOption: line.paymentOption,
      fulfilment: line.fulfilment,
      amountKobo: line.basePriceKobo * line.quantity,
      processingFeeKobo: line.processingFeeKobo * line.quantity,
      releaseWindowHours: line.releaseWindowHours,
      terms: line.termsSnapshot,
    })),
    subtotalKobo: review.subtotalKobo,
    processingFeeKobo: review.processingFeeKobo,
    totalKobo: review.totalKobo,
    currency: 'NGN',
  };
}

cartCheckoutRouter.post('/checkout/review', validate(Joi.object({
  deliveryAddress: Joi.string().trim().max(500).allow('').default(''),
  orders: Joi.array().items(orderChoiceSchema.fork(['quantity'], (field) => field.optional())).max(50).default([]),
})), asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const address = req.body.deliveryAddress || buyer.cartDeliveryAddress || '';
  const review = await buildReview(buyer, req.body.orders, address);
  res.json(reviewResponse(review));
}));

// WHAT: create the payment for a reviewed set of orders. Shared by cart checkout and instant checkout.
// WHY a shared function: the idempotency, demo-seller, bank-account and transaction-creation rules
// must be identical however the buyer arrived, so there is exactly one copy of them.
async function payForOrders(req, res, { orders, itemsOverride = null, callbackPath = '/cart' }) {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const address = req.body.deliveryAddress || buyer.cartDeliveryAddress || '';
  const review = await buildReview(buyer, orders, address, itemsOverride);
  const requestHash = createHash('sha256').update(JSON.stringify({
    orders: review.lines.map((line) => ({
      listingType: line.listingType,
      listingId: line.listingId,
      quantity: line.quantity,
      paymentOption: line.paymentOption,
      fulfilment: line.fulfilment,
    })).sort((a, b) => `${a.listingType}:${a.listingId}`.localeCompare(`${b.listingType}:${b.listingId}`)),
    deliveryAddress: review.deliveryAddress,
    totalKobo: review.totalKobo,
  })).digest('hex');
  if (review.requiresDeliveryAddress && address.trim().length < 10) {
    throw new AppError(400, 'Enter a delivery address of at least 10 characters.');
  }
  const sellerIds = review.lines.map((line) => line.listing.seller?._id).filter(Boolean);
  if (sellerIds.length && await User.exists({ _id: { $in: sellerIds }, isDemoSeed: true })) {
    throw new AppError(409, 'Demo listings are for browsing only and cannot accept real payment.');
  }
  const sellers = await User.find({ _id: { $in: sellerIds } }).select('bankAccount');
  const sellerById = new Map(sellers.map((seller) => [String(seller._id), seller]));
  for (const line of review.lines) {
    const seller = sellerById.get(String(line.listing.seller?._id));
    if (line.paymentOption === 'direct' && !seller?.bankAccount?.accountNumber) {
      throw new AppError(409, `${line.listing.seller?.businessName || 'This seller'} is not ready to receive payment without escrow.`);
    }
  }

  const provider = await getPaymentProviderName();
  const reference = generateReference('escrit-cart');
  let attempt;
  try {
    attempt = await CheckoutAttempt.create({
      buyerId: buyer._id,
      idempotencyKey: req.body.idempotencyKey,
      reference,
      amountKobo: review.totalKobo,
      requestHash,
      paymentProvider: provider,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    attempt = await CheckoutAttempt.findOne({ buyerId: buyer._id, idempotencyKey: req.body.idempotencyKey });
    if (!attempt) throw error;
    if (attempt.requestHash && attempt.requestHash !== requestHash) {
      throw new AppError(409, 'This payment key was already used for a different order. Return to Review and try again.');
    }
    if (attempt.status === 'failed') return res.json({
      reference: attempt.reference,
      status: 'failed',
      errorMessage: attempt.errorMessage || 'This payment attempt failed. Return to Review and try again.',
    });
    if (attempt.status === 'confirmed') return res.json({ reference: attempt.reference, status: 'confirmed', amountKobo: attempt.amountKobo });
    if (attempt.authorizationUrl) return res.json({
      reference: attempt.reference,
      status: 'pending',
      authorizationUrl: attempt.authorizationUrl,
      amountKobo: attempt.amountKobo,
    });
    throw new AppError(409, 'This payment is already being prepared. Please wait a moment.');
  }

  let transactions = [];
  try {
    const links = await Link.find({ _id: { $in: review.lines.map((line) => line.listing.escrowLinkId) }, active: true });
    if (links.length !== review.lines.length) throw new AppError(409, 'A cart listing is no longer available for checkout.');
    await Promise.all(links.map(ensureCheckoutPrice));
    transactions = await Transaction.create(review.lines.map((line) => ({
      linkId: line.listing.escrowLinkId,
      checkoutAttemptId: attempt._id,
      paymentProvider: provider,
      paymentReference: reference,
      checkoutTotalKobo: review.totalKobo,
      buyerPriceKoboSnapshot: line.buyerPriceKobo,
      sellerPayoutBaseKobo: line.basePriceKobo,
      checkoutQuantity: line.quantity,
      checkoutMode: line.paymentOption,
      fulfillmentStatus: 'NOT_STARTED',
      termsAcceptedAt: new Date(),
      termsSnapshot: line.termsSnapshot,
      releaseWindowHours: line.releaseWindowHours,
      deliveryAddressSnapshot: line.fulfilment === 'delivery' ? review.deliveryAddress : '',
      buyerUserId: buyer._id,
      buyerEmail: buyer.email,
    })));
    attempt.transactionIds = transactions.map((transaction) => transaction._id);
    await attempt.save();

    const payment = await initializeTransaction({
      email: buyer.email,
      amountKobo: review.totalKobo,
      reference,
      callbackUrl: `${env.clientOrigins[0]}${callbackPath}?reference=${encodeURIComponent(reference)}`,
      metadata: {
        checkoutAttemptId: String(attempt._id),
        transactionIds: transactions.map((transaction) => String(transaction._id)),
        buyerId: String(buyer._id),
      },
    });
    await Promise.all(transactions.map(async (transaction) => {
      transaction.paymentProviderTransactionId = payment.id ? String(payment.id) : null;
      await transaction.save();
    }));
    attempt.status = 'pending';
    attempt.authorizationUrl = payment.authorization_url;
    await attempt.save();
    res.json({ reference, status: 'pending', authorizationUrl: payment.authorization_url, amountKobo: review.totalKobo });
  } catch (error) {
    attempt.status = 'failed';
    attempt.errorMessage = 'We could not prepare your payment. Return to Review and try again.';
    await attempt.save();
    if (transactions.length) await Transaction.deleteMany({ _id: { $in: transactions.map((transaction) => transaction._id) } });
    throw error;
  }
}

cartCheckoutRouter.post('/checkout/pay', validate(checkoutSchema), asyncHandler((req, res) => payForOrders(req, res, { orders: req.body.orders })));

// WHAT: instant checkout for a single course, with no cart.
// WHY: a course is bought on its own and grants access once paid. Review and pay reuse the
// cart's code (buildReview / payForOrders), so pricing, fees and idempotency match exactly.
const instantItemSchema = Joi.object({
  listingType: Joi.string().valid(...instantListingTypes).required(),
  listingId: listingIdSchema.required(),
});
function instantEntry(item) {
  return { listingType: item.listingType, listingId: item.listingId, quantity: 1, paymentOption: 'direct', fulfilment: '' };
}
cartCheckoutRouter.post('/checkout/instant/review', validate(Joi.object({ item: instantItemSchema.required() })), asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const entry = instantEntry(req.body.item);
  const review = await buildReview(buyer, [], '', [entry]);
  res.json(reviewResponse(review));
}));
cartCheckoutRouter.post('/checkout/instant/pay', validate(Joi.object({
  idempotencyKey: Joi.string().trim().min(8).max(120).required(),
  termsAccepted: Joi.boolean().valid(true).required(),
  item: instantItemSchema.required(),
})), asyncHandler((req, res) => {
  const entry = instantEntry(req.body.item);
  return payForOrders(req, res, { orders: [{ ...entry }], itemsOverride: [entry], callbackPath: '/cart' });
}));

cartCheckoutRouter.get('/checkout/status/:reference', asyncHandler(async (req, res) => {
  const attempt = await CheckoutAttempt.findOne({ reference: req.params.reference, buyerId: req.sellerId });
  if (!attempt) throw new AppError(404, 'Checkout not found');
  let transactions = await Transaction.find({ _id: { $in: attempt.transactionIds } });
  if (attempt.status === 'pending' && transactions[0]) {
    await reconcileWithPaymentProvider(transactions[0], req.app.get('io'));
    transactions = await Transaction.find({ _id: { $in: attempt.transactionIds } });
  }
  const confirmed = transactions.length > 0 && transactions.every((transaction) => transaction.status !== TX_STATUS.CREATED);
  let contactItems = [];
  if (confirmed && attempt.status !== 'confirmed') {
    attempt.status = 'confirmed';
    await attempt.save();
  }
  if (confirmed) {
    const links = await Link.find({ _id: { $in: transactions.map((transaction) => transaction.linkId) } })
      .select('listingType listingId');
    const savedEntries = links.filter((link) => link.listingType && link.listingId).map((link) => ({
      listingType: link.listingType,
      listingId: link.listingId,
      quantity: 1,
    }));
    contactItems = await populateSavedItems(savedEntries);
    const buyer = await User.findById(req.sellerId);
    if (!buyer) throw new AppError(404, 'Account not found');
    const purchased = new Set(links.filter((link) => link.listingType && link.listingId)
      .map((link) => `${link.listingType}:${link.listingId}`));
    const remaining = buyer.cartItems.filter((entry) => !purchased.has(`${entry.listingType}:${entry.listingId}`));
    if (remaining.length !== buyer.cartItems.length) {
      buyer.cartItems = remaining;
      await buyer.save();
    }
  }
  res.json({
    reference: attempt.reference,
    status: confirmed ? 'confirmed' : attempt.status === 'failed' ? 'failed' : 'pending',
    orders: transactions.map((transaction) => ({
      id: String(transaction._id),
      status: transaction.status,
      title: transaction.termsSnapshot.split('\n\n')[0] || 'Escrit order',
      checkoutMode: transaction.checkoutMode,
      amountKobo: transaction.buyerPriceKoboSnapshot * transaction.checkoutQuantity,
    })),
    contactItems,
  });
}));

cartCheckoutRouter.get('/me/recently-viewed', asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const entries = buyer.recentlyViewedListings.slice(-10).reverse();
  res.json({ items: await populateSavedItems(entries) });
}));

cartCheckoutRouter.post('/me/recently-viewed', validate(recentSchema), asyncHandler(async (req, res) => {
  const { listingType, listingId } = req.body;
  await loadListing(listingType, listingId);
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  buyer.recentlyViewedListings = buyer.recentlyViewedListings.filter(
    (entry) => !(entry.listingType === listingType && String(entry.listingId) === listingId),
  );
  buyer.recentlyViewedListings.push({ listingType, listingId, viewedAt: new Date() });
  buyer.recentlyViewedListings = buyer.recentlyViewedListings.slice(-10);
  await buyer.save();
  res.json({ ok: true });
}));

cartCheckoutRouter.get('/listings/similar', asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 30);
  const excluded = new Set(ids.map((value) => value.split(':').pop()));
  const cartEntries = await populateSavedItems((await User.findById(req.sellerId))?.cartItems || []);
  const categories = new Set(cartEntries.map((entry) => entry.listing.category).filter(Boolean));
  const types = new Set(cartEntries.map((entry) => entry.listingType));
  if (!types.size) listingTypes.forEach((type) => types.add(type));
  const ModelByType = { product: Product, course: Course, service: Service };
  const candidateGroups = await Promise.all([...types].map(async (type) => {
    const Model = ModelByType[type];
    const filter = {
      isActive: true,
      isVerified: true,
      seller: { $ne: req.sellerId },
      ...(categories.size ? { category: { $in: [...categories] } } : {}),
      _id: { $nin: [...excluded] },
    };
    return (await Model.find(filter).limit(30).populate('seller', 'businessName displayName fullName profilePictureUrl kycStatus transactionPreferences onboarding.fulfilmentDefault averageRating reviewCount'))
      .map((item) => publicListing(item, type));
  }));
  res.json({
    items: candidateGroups.flat()
      .sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0) || (b.ratingCount || 0) - (a.ratingCount || 0))
      .slice(0, 10),
  });
}));
