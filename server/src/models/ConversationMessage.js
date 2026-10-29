import mongoose from 'mongoose';

const conversationMessageSchema = new mongoose.Schema(
  {
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOffer', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientMessageId: { type: String, trim: true, maxlength: 128, default: null },
    type: { type: String, enum: ['text', 'offer'], default: 'text' },
    body: { type: String, trim: true, maxlength: 2000, default: '' },
    offerEvent: { type: mongoose.Schema.Types.Mixed, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationMessageSchema.index({ offerId: 1, createdAt: 1 });
conversationMessageSchema.index(
  { offerId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } }
);
conversationMessageSchema.index({ recipientId: 1, createdAt: -1 });
conversationMessageSchema.index({ recipientId: 1, readAt: 1 });

export const ConversationMessage = mongoose.model('ConversationMessage', conversationMessageSchema);