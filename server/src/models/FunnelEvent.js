import mongoose from 'mongoose';

const funnelEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: [
        'link_preview_viewed',
        'registration_started',
        'registration_completed',
        'returned_to_transaction',
        'terms_accepted',
        'payment_completed',
      ],
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    linkId: { type: String, default: '' },
    transactionId: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const FunnelEvent = mongoose.model('FunnelEvent', funnelEventSchema);
