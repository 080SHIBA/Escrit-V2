import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
  {
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    referredName: { type: String, default: '', trim: true },
    referredEmail: { type: String, default: '', lowercase: true, trim: true },
    status: { type: String, enum: ['registered', 'rewarded', 'ineligible'], default: 'registered', index: true },
    rewardCredits: { type: Number, default: 25 },
    awardedAt: { type: Date, default: null },
    firstPurchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditPurchase', default: null },
  },
  { timestamps: true }
);

export const Referral = mongoose.model('Referral', referralSchema);

