import mongoose from 'mongoose';

const platformCreditEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['earned', 'spent', 'adjustment', 'purchased'], required: true },
    credits: { type: Number, default: 0 },
    amountKobo: { type: Number, required: true },
    reason: { type: String, required: true, maxlength: 300 },
    balanceAfter: { type: Number, default: null },
    listingId: { type: mongoose.Schema.Types.ObjectId, default: null },
    listingType: { type: String, enum: ['product', 'course', 'service', null], default: null },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromotionCampaign', default: null },
    paymentReference: { type: String, default: null },
  },
  { timestamps: true }
);

export const PlatformCreditEntry = mongoose.model('PlatformCreditEntry', platformCreditEntrySchema);
