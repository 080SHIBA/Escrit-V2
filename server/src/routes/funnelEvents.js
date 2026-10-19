import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { publicLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { recordFunnelEvent } from '../services/funnel.js';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

export const funnelEventsRouter = Router();
funnelEventsRouter.use(publicLimiter);

const eventSchema = Joi.object({
  event: Joi.string().valid(
    'link_preview_viewed',
    'registration_started',
    'returned_to_transaction',
  ).required(),
  linkId: Joi.string().pattern(/^[a-f\d]{24}$/i).allow('').default(''),
  transactionId: Joi.string().pattern(/^[a-f\d]{24}$/i).allow('').default(''),
});

funnelEventsRouter.post('/', (req, res, next) => (
  req.body?.event === 'returned_to_transaction' ? requireAuth(req, res, next) : next()
), validate(eventSchema), asyncHandler(async (req, res) => {
  let userId = null;
  if (req.body.event === 'returned_to_transaction') {
    const user = await User.findById(req.sellerId).select('pendingEscrowReturn');
    const target = user?.pendingEscrowReturn;
    if (!target
      || String(target.linkId) !== req.body.linkId
      || String(target.transactionId || '') !== req.body.transactionId) {
      throw new AppError(403, 'This transaction return is no longer available');
    }
    userId = user._id;
  }
  await recordFunnelEvent(req.body.event, {
    userId,
    linkId: req.body.linkId,
    transactionId: req.body.transactionId,
  });
  res.status(202).json({ ok: true });
}));
