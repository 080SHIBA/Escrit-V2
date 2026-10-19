import { Router } from 'express';
import Joi from 'joi';
import { User } from '../models/User.js';
import { Link } from '../models/Link.js';
import { Transaction } from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveAccountNumber, listBanks } from '../services/paymentProvider.js';

export const sellerRouter = Router();
sellerRouter.use(requireAuth);

export const profileRouter = Router();
profileRouter.use(requireAuth);

export const bankResolverRouter = Router();
bankResolverRouter.use(requireAuth);

const profileSchema = Joi.object({
  displayName: Joi.string().trim().max(80).allow(''),
  businessName: Joi.string().trim().min(2).max(80),
  phone: Joi.string().trim().max(40).allow(''),
  city: Joi.string().trim().max(100).allow(''),
  fullName: Joi.string().trim().min(2).max(120),
  nin: Joi.string().trim().min(5).max(40).allow(''),
  idDocumentUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow(''),
  bio: Joi.string().trim().max(500).allow(''),
  profilePictureUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow(''),
}).min(1);

const patchProfile = [validate(profileSchema), asyncHandler(async (req, res) => {
  const current = await User.findById(req.sellerId);
  if (!current) throw new AppError(404, 'Seller not found');
  const changedKyc = ['fullName', 'nin', 'idDocumentUrl'].some(
    (key) => req.body[key] !== undefined && current[key] !== req.body[key]
  );
  const seller = await User.findByIdAndUpdate(req.sellerId, {
    ...req.body,
    ...(changedKyc ? { kycStatus: 'none', kycReviewNote: '', kycReviewedAt: null } : {}),
  }, { new: true, runValidators: true });
  if (!seller) throw new AppError(404, 'Seller not found');
  res.json({ seller });
})];

sellerRouter.patch('/profile', ...patchProfile);
profileRouter.patch('/', ...patchProfile);

sellerRouter.get('/banks', asyncHandler(async (_req, res) => {
  const banks = await listBanks();
  res.json({ banks });
}));

bankResolverRouter.get('/resolve', asyncHandler(async (req, res) => {
  const bankCode = String(req.query.bank || '');
  const accountNumber = String(req.query.account || '');
  if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
    throw new AppError(422, 'Choose a bank and enter a valid 10-digit account number');
  }

  const account = await resolveAccountNumber({ accountNumber, bankCode });
  if (!account?.account_name) throw new AppError(422, 'We could not resolve this bank account');
  res.json({ account_name: account.account_name });
}));

sellerRouter.get('/payout-history', asyncHandler(async (req, res) => {
  const links = await Link.find({ sellerId: req.sellerId }).select('_id itemName').lean();
  const linkNames = new Map(links.map((link) => [String(link._id), link.itemName]));
  const transactions = await Transaction.find({
    linkId: { $in: links.map((link) => link._id) },
    payoutState: 'completed',
    releasedAt: { $ne: null },
  })
    .select('_id linkId releasedAt payoutLog sellerPayoutBaseKobo checkoutQuantity status')
    .sort({ releasedAt: -1 })
    .lean();

  const payouts = transactions.flatMap((transaction) => {
    const payout = [...(transaction.payoutLog || [])]
      .reverse()
      .find((entry) => entry.action === 'transfer_initiated');
    if (!payout) return [];
    const detail = payout.detail || {};
    const baseKobo = detail.sellerBaseKobo ?? transaction.sellerPayoutBaseKobo;
    if (!Number.isFinite(baseKobo)) return [];
    const amountKobo = baseKobo * (detail.sellerBaseKobo == null ? (transaction.checkoutQuantity || 1) : 1)
      - (detail.commissionKobo || 0);
    return [{
      orderId: String(transaction._id),
      itemName: linkNames.get(String(transaction.linkId)) || 'Escrow order',
      amountKobo,
      releasedAt: transaction.releasedAt,
      status: transaction.payoutState,
    }];
  });
  res.json({ payouts });
}));

const bankAccountSchema = Joi.object({
  accountNumber: Joi.string().length(10).pattern(/^\d+$/).required(),
  bankCode: Joi.string().required(),
  bankName: Joi.string().required(),
});

// Verifies the account with the bank via Flutterwave and saves the payout
// destination. The name shown to buyers always comes from the bank, never
// from what the seller typed.
sellerRouter.post('/bank-account', validate(bankAccountSchema), asyncHandler(async (req, res) => {
  const { accountNumber, bankCode, bankName } = req.body;

  const resolved = await resolveAccountNumber({ accountNumber, bankCode });
  const user = await User.findByIdAndUpdate(
    req.sellerId,
    {
      bankAccount: {
        accountNumber,
        bankCode,
        bankName,
        resolvedAccountName: resolved.account_name,
      },
    },
    { new: true }
  );

  if (!user) throw new AppError(404, 'Seller not found');
  res.json({ seller: user });
}));
