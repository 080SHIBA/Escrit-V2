import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { ConversationMessage } from '../models/ConversationMessage.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const recipientId = req.sellerId;
  const [eventNotifications, messages, eventUnread, messageUnread] = await Promise.all([
    Notification.find({ recipientId }).sort({ createdAt: -1 }).limit(50).lean(),
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
    Notification.countDocuments({ recipientId, readAt: null }),
    ConversationMessage.countDocuments({ recipientId, readAt: null }),
  ]);

  const combined = [
    ...eventNotifications.map((notification) => ({
      ...notification,
      notificationType: notification.type,
      body: notification.message,
    })),
    ...messages.map((message) => ({
      ...message,
      notificationType: 'service_message',
      title: message.type === 'offer' ? 'Service proposal update' : 'New service message',
      body: message.type === 'offer'
        ? `A service proposal was ${message.offerEvent?.action || 'updated'}.`
        : message.body,
      href: `/account/offers/${message.offerId?._id || message.offerId}`,
    })),
  ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 50);

  res.json({ notifications: combined, unreadCount: eventUnread + messageUnread });
}));

notificationsRouter.get('/preferences', asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId).select('marketingEmailOptIn');
  if (!user) return res.status(404).json({ message: 'Account not found' });
  res.json({ marketingEmailOptIn: Boolean(user.marketingEmailOptIn) });
}));

notificationsRouter.patch('/preferences', validate(Joi.object({
  marketingEmailOptIn: Joi.boolean().required(),
})), asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.sellerId,
    { marketingEmailOptIn: req.body.marketingEmailOptIn },
    { new: true, runValidators: true }
  ).select('marketingEmailOptIn');
  if (!user) return res.status(404).json({ message: 'Account not found' });
  res.json({ marketingEmailOptIn: Boolean(user.marketingEmailOptIn) });
}));

notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.sellerId, readAt: null },
    { readAt: new Date() },
    { new: true }
  );
  res.json({ ok: true, readAt: notification?.readAt || null });
}));
