import { Router } from 'express';
import Joi from 'joi';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { Transaction } from '../models/Transaction.js';

export const onboardingRouter = Router();
onboardingRouter.use(requireAuth);

const categories = [
  'Fashion', 'Electronics', 'Home & living', 'Beauty & health',
  'Food & groceries', 'Digital goods', 'Design services', 'Tech services',
];
const steps = ['welcome', 'buy', 'sell1', 'sell2', 'sell3', 'escrow', 'trust', 'done', 'return', 'escrow-welcome', 'escrow-preview'];
const verificationIntentSchema = Joi.object({
  identity: Joi.string().valid('', 'soon', 'planned', 'later'),
  bank: Joi.string().valid('', 'soon', 'planned', 'later'),
}).min(1);
const onboardingPatchSchema = Joi.object({
  goals: Joi.array().items(Joi.string().valid('Buy', 'Sell', 'Escrow')).unique(),
  interests: Joi.array().items(Joi.string().valid('Products', 'Courses', 'Services')).unique(),
  categories: Joi.array().items(Joi.string().valid(...categories)).unique(),
  city: Joi.string().trim().max(100).allow(''),
  sellerTypes: Joi.array().items(Joi.string().valid('Products', 'Courses', 'Services')).unique(),
  displayName: Joi.string().trim().max(80).allow(''),
  fulfilmentDefault: Joi.string().valid('', 'delivery', 'pickup', 'both'),
  verificationIntent: verificationIntentSchema,
  currentStep: Joi.string().valid(...steps),
  flow: Joi.string().valid('new-user', 'escrow-link'),
  completed: Joi.boolean(),
}).min(1);

onboardingRouter.get('/onboarding', asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  const onboarding = user.onboarding?.toObject?.() || {};
  if (!onboarding.goals?.length) {
    onboarding.goals = (user.accountIntents || []).map((intent) => intent === 'Escrow links' ? 'Escrow' : intent);
  }
  if (!onboarding.displayName) onboarding.displayName = user.displayName || user.fullName || user.businessName || '';
  if (!onboarding.city) onboarding.city = user.city || '';
  if (user.pendingEscrowReturn) {
    onboarding.flow = 'escrow-link';
    onboarding.currentStep = ['escrow-welcome', 'escrow-preview'].includes(onboarding.currentStep)
      ? onboarding.currentStep
      : 'escrow-welcome';
    onboarding.completed = false;
  }
  res.json({ onboarding });
}));

onboardingRouter.patch('/onboarding', validate(onboardingPatchSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');

  for (const [key, value] of Object.entries(req.body)) {
    if (key === 'verificationIntent') {
      for (const [intent, timing] of Object.entries(value)) user.set(`onboarding.verificationIntent.${intent}`, timing);
    } else {
      user.set(`onboarding.${key}`, value);
    }
    if (req.body.completed && req.body.flow === 'escrow-link') {
      user.pendingEscrowReturn = null;
    }
  }
  if (req.body.displayName !== undefined) user.displayName = req.body.displayName;
  if (req.body.city !== undefined) user.city = req.body.city;
  if (req.body.goals !== undefined) {
    user.accountIntents = req.body.goals.map((goal) => goal === 'Escrow' ? 'Escrow links' : goal);
  }
  await user.save();
  res.json({ onboarding: user.onboarding });
}));

onboardingRouter.post('/onboarding/complete-escrow-return', asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  user.pendingEscrowReturn = null;
  user.set('onboarding.flow', 'new-user');
  user.set('onboarding.currentStep', 'done');
  user.set('onboarding.completed', true);
  await user.save();
  res.json({ ok: true });
}));

onboardingRouter.post('/retention-prompt/dismiss-screen', asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  user.escrowRecipientPromptEligible = true;
  user.pendingEscrowReturn = null;
  user.set('onboarding.flow', 'new-user');
  user.set('onboarding.currentStep', 'done');
  user.set('onboarding.completed', true);
  await user.save();
  res.json({ ok: true });
}));

onboardingRouter.get('/retention-prompt', asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  if (user.escrowRecipientPromptShownAt) return res.json({ show: false });

  const finishedTransaction = await Transaction.exists({
    buyerUserId: user._id,
    checkoutMode: 'escrow',
    status: { $in: ['RELEASED', 'RESOLVED_RELEASED', 'RESOLVED_CREDITED', 'RESOLVED_REFUNDED'] },
  });
  if (!user.escrowRecipientPromptEligible && !finishedTransaction) return res.json({ show: false });

  const claimed = await User.findOneAndUpdate(
    { _id: user._id, escrowRecipientPromptShownAt: null },
    { $set: { escrowRecipientPromptShownAt: new Date() } },
    { new: true, projection: { _id: 1 } },
  );
  res.json({ show: Boolean(claimed) });
}));
