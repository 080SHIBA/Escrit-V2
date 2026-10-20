import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { Link } from '../models/Link.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { publicSellerName } from '../utils/publicSellerName.js';
import { raiseDispute, releaseOnBuyerConfirmation } from '../services/escrow.js';
import { deliveryReleaseTime } from '../../../shared/orderState.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const paidOutStatuses = new Set([
  TX_STATUS.RELEASED,
  TX_STATUS.RESOLVED_RELEASED,
  TX_STATUS.RESOLVED_CREDITED,
  TX_STATUS.RESOLVED_REFUNDED,
  TX_STATUS.DIRECT_PAID,
  TX_STATUS.DIRECT_COMPLETED,
]);

function toStage(transaction) {
  if (paidOutStatuses.has(transaction.status)) return 3;
  if (transaction.status === TX_STATUS.CREATED) return 0;
  if (['DELIVERED', 'SERVICE_COMPLETE'].includes(transaction.fulfillmentStatus)) return 2;
  return 1;
}

function toOrder(transaction, role, counterparty) {
  const link = transaction.linkId;
  return {
    id: String(transaction._id),
    title: link.itemName,
    counterparty: counterparty || 'Escrit buyer',
    storefrontId: role === 'buy' ? String(link.sellerId?._id || link.sellerId) : null,
    amount: ((transaction.buyerPriceKoboSnapshot ?? transaction.checkoutTotalKobo ?? 0) * (transaction.checkoutQuantity || 1)) / 100,
    stage: toStage(transaction),
    disputed: transaction.status === TX_STATUS.DISPUTED,
    deliveredAt: transaction.deliveredAt || transaction.fulfillmentUpdatedAt || null,
    releaseDueAt: transaction.releaseDueAt || null,
    releaseWindowHours: transaction.releaseWindowHours,
    linkId: String(link._id),
    status: transaction.status,
    payoutState: transaction.payoutState,
    finalOutcome: transaction.status === TX_STATUS.RESOLVED_REFUNDED
      ? 'refunded'
      : transaction.status === TX_STATUS.RESOLVED_CREDITED ? 'credited' : null,
    role,
  };
}

ordersRouter.get('/', asyncHandler(async (req, res) => {
  const role = req.query.role;
  if (!['sell', 'buy'].includes(role)) throw new AppError(400, 'Choose whether to view selling or buying orders');

  let transactions;
  if (role === 'sell') {
    const links = await Link.find({ sellerId: req.sellerId }).select('_id');
    transactions = await Transaction.find({ linkId: { $in: links.map((link) => link._id) } })
      .sort({ createdAt: -1 }).populate('linkId', 'itemName');
    const buyerIds = transactions.map((tx) => tx.buyerUserId).filter(Boolean);
    const buyers = await User.find({ _id: { $in: buyerIds } }).select('displayName businessName');
    const buyerById = new Map(buyers.map((buyer) => [String(buyer._id), buyer.displayName || buyer.businessName]));
    return res.json({
      orders: transactions.filter((tx) => tx.linkId).map((tx) =>
        toOrder(tx, role, buyerById.get(String(tx.buyerUserId))),
      ),
    });
  }

  transactions = await Transaction.find({ buyerUserId: req.sellerId })
    .sort({ createdAt: -1 }).populate('linkId', 'itemName sellerId');
  const sellerIds = transactions.map((tx) => tx.linkId?.sellerId).filter(Boolean);
  const sellers = await User.find({ _id: { $in: sellerIds } }).select('displayName businessName fullName');
  const sellerById = new Map(sellers.map((seller) => [String(seller._id), publicSellerName(seller)]));
  res.json({
    orders: transactions.filter((tx) => tx.linkId).map((tx) =>
      toOrder(tx, role, sellerById.get(String(tx.linkId.sellerId))),
    ),
  });
}));

const disputeSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required(),
});

async function loadAuthorizedOrder(req, role) {
  if (!/^[\da-f]{24}$/i.test(req.params.id)) throw new AppError(400, 'Enter a valid order id');
  const transaction = await Transaction.findById(req.params.id).populate('linkId');
  if (!transaction?.linkId) throw new AppError(404, 'This order could not be found');
  const authorized = role === 'sell'
    ? String(transaction.linkId.sellerId) === String(req.sellerId)
    : String(transaction.buyerUserId) === String(req.sellerId);
  if (!authorized) throw new AppError(404, 'This order could not be found');
  return transaction;
}

ordersRouter.post('/:id/deliver', asyncHandler(async (req, res) => {
  const transaction = await loadAuthorizedOrder(req, 'sell');
  if (transaction.status !== TX_STATUS.PAID_HELD) throw new AppError(409, 'This order is not currently held in escrow');
  if (transaction.fulfillmentStatus === 'DELIVERED' || transaction.fulfillmentStatus === 'SERVICE_COMPLETE') {
    throw new AppError(409, 'This order has already been marked delivered');
  }
  if (transaction.fulfillmentStatus === 'BUYER_NO_SHOW') {
    throw new AppError(409, 'This order is under review for a missed delivery and cannot be marked delivered');
  }

  const deliveredAt = new Date();
  transaction.fulfillmentStatus = transaction.linkId.fulfillmentType === 'service' ? 'SERVICE_COMPLETE' : 'DELIVERED';
  transaction.fulfillmentUpdatedAt = deliveredAt;
  transaction.deliveredAt = deliveredAt;
  transaction.releaseDueAt = deliveryReleaseTime(deliveredAt, transaction.releaseWindowHours);
  await transaction.save();
  const buyer = transaction.buyerUserId
    ? await User.findById(transaction.buyerUserId).select('displayName businessName')
    : null;
  res.json({ order: toOrder(transaction, 'sell', buyer?.displayName || buyer?.businessName) });
}));

ordersRouter.post('/:id/confirm', asyncHandler(async (req, res) => {
  const transaction = await loadAuthorizedOrder(req, 'buy');
  await releaseOnBuyerConfirmation(transaction);
  const seller = await User.findById(transaction.linkId.sellerId).select('displayName businessName');
  res.json({ order: toOrder(transaction, 'buy', seller?.displayName || seller?.businessName) });
}));

ordersRouter.post('/:id/dispute', validate(disputeSchema), asyncHandler(async (req, res) => {
  const transaction = await loadAuthorizedOrder(req, 'buy');
  await raiseDispute(transaction, req.body.reason);
  transaction.status = TX_STATUS.DISPUTED;
  transaction.disputeReason = req.body.reason;
  const seller = await User.findById(transaction.linkId.sellerId).select('displayName businessName');
  res.json({ order: toOrder(transaction, 'buy', seller?.displayName || seller?.businessName) });
}));
