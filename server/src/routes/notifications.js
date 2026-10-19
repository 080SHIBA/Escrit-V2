import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ConversationMessage } from '../models/ConversationMessage.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const recipientId = req.sellerId;
  const [notifications, unreadCount] = await Promise.all([
    ConversationMessage.find({ recipientId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('senderId', 'businessName displayName profilePictureUrl')
      .populate({
        path: 'offerId',
        select: 'serviceId',
        populate: { path: 'serviceId', select: 'title' },
      })
      .lean(),
    ConversationMessage.countDocuments({ recipientId, readAt: null }),
  ]);

  res.json({ notifications, unreadCount });
}));
