import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    href: { type: String, required: true, trim: true, maxlength: 300 },
    dedupeKey: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

export const Notification = mongoose.model('Notification', notificationSchema);
