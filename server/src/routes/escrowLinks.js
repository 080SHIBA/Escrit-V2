import { Router } from 'express';
import mongoose from 'mongoose';
import { Link } from '../models/Link.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { recordFunnelEvent } from '../services/funnel.js';
import { ensureCheckoutPrice } from '../services/pricing.js';
import { classifyEscrowPreviewState } from '../utils/escrowPreviewState.js';

export const escrowLinksRouter = Router();
escrowLinksRouter.use(requireAuth);

const invalidPreview = () => ({ state: 'invalid' });

escrowLinksRouter.get('/:id/preview', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.json({ preview: invalidPreview() });

  const link = await Link.findById(id).select(
    'itemName priceKobo checkoutPriceKobo termsSnapshot fulfillmentType active expiresAt sellerId'
  );
  if (!link) return res.json({ preview: invalidPreview() });

  const amountKobo = await ensureCheckoutPrice(link);
  let transaction = null;
  let transactionId = '';
  if (req.query.transactionId !== undefined) {
    transactionId = String(req.query.transactionId);
    if (!mongoose.isValidObjectId(transactionId)) return res.json({ preview: invalidPreview() });
    transaction = await Transaction.findOne({ _id: transactionId, linkId: link._id });
  }
  const requester = await User.findById(req.sellerId).select('email');
  const state = classifyEscrowPreviewState({
    link,
    transaction,
    transactionRequested: req.query.transactionId !== undefined,
    requesterId: req.sellerId,
    requesterEmail: requester?.email,
  });

  const seller = await User.findById(link.sellerId).select('displayName businessName');
  const preview = {
    state,
    linkId: String(link._id),
    transactionId,
    title: link.itemName,
    amountKobo,
    from: seller?.displayName || seller?.businessName || 'Escrit seller',
    releaseRule: link.fulfillmentType === 'service'
      ? 'This service uses direct payment and is not held in escrow.'
      : 'Funds are released according to the terms shown on the transaction page.',
    fees: 'Shown before you pay.',
    termsSnapshot: link.termsSnapshot || link.itemDescription || 'The seller will confirm delivery details with you before checkout.',
  };

  if (state !== 'invalid') {
    recordFunnelEvent('link_preview_viewed', {
      userId: req.sellerId,
      linkId: String(link._id),
      transactionId,
    }).catch((error) => console.error('[funnel] could not record link_preview_viewed', error.message));
  }

  res.json({ preview });
}));
