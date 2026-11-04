import mongoose from 'mongoose';

const creditPackageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    credits: { type: Number, required: true },
    priceKobo: { type: Number, required: true },
    bonusText: { type: String, default: '' },
    popular: { type: Boolean, default: false },
  },
  { _id: false }
);

const promotionDurationSchema = new mongoose.Schema(
  {
    days: { type: Number, required: true },
    label: { type: String, required: true },
    promoteCredits: { type: Number, required: true },
    featureCredits: { type: Number, required: true },
  },
  { _id: false }
);

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true },
    commissionPercent: { type: Number, min: 0, max: 25, default: 5 },
    paymentProvider: { type: String, enum: ['paystack', 'flutterwave'], default: 'paystack' },
    // Owner-controlled, switchable without a redeploy — see services/paymentMode.js.
    // "test" is the safe default so a fresh deploy never accidentally takes live money.
    paymentMode: { type: String, enum: ['live', 'test'], default: 'test' },
    creditPackages: {
      type: [creditPackageSchema],
      default: () => [
        { id: 'starter', name: 'Starter', credits: 50, priceKobo: 500000, bonusText: 'Standard rate', popular: false },
        { id: 'growth', name: 'Growth', credits: 120, priceKobo: 1000000, bonusText: 'Save 17% · 20 bonus credits', popular: true },
        { id: 'business', name: 'Business', credits: 300, priceKobo: 2250000, bonusText: 'Save 25% · Best value', popular: false },
      ],
    },
    referralRewardCredits: { type: Number, default: 25 },
    promotionPricing: {
      type: [promotionDurationSchema],
      default: () => [
        { days: 3, label: '3 days', promoteCredits: 15, featureCredits: 25 },
        { days: 7, label: '7 days', promoteCredits: 30, featureCredits: 50 },
        { days: 14, label: '14 days', promoteCredits: 55, featureCredits: 90 },
        { days: 30, label: '30 days', promoteCredits: 100, featureCredits: 160 },
      ],
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);
