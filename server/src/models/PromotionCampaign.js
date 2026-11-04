import mongoose from 'mongoose';

const promotionCampaignSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    listingType: { type: String, enum: ['product', 'course', 'service'], required: true },
    listingTitle: { type: String, required: true, trim: true },
    listingCoverUrl: { type: String, default: '' },
    packageType: { type: String, enum: ['promote', 'feature'], default: 'promote' },
    durationDays: { type: Number, required: true, min: 1 },
    creditsCost: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'scheduled', 'completed', 'cancelled'], default: 'active', index: true },
  },
  { timestamps: true }
);

export const PromotionCampaign = mongoose.model('PromotionCampaign', promotionCampaignSchema);

