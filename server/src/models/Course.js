import mongoose from 'mongoose';

const curriculumItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
  },
  { _id: false }
);

const scheduledDiscountSchema = new mongoose.Schema(
  {
    percent: { type: Number, min: 1, max: 100, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    escrowLinkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', default: null },
    paymentOptions: {
      escrow: { type: Boolean, default: true },
      direct: { type: Boolean, default: true },
    },
    overridesDefault: { type: Boolean, default: false },
    fulfillmentOverridesDefault: { type: Boolean, default: false },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    images: { type: [String], default: [] },
    category: { type: String, default: 'General' },
    categoryReviewStatus: { type: String, enum: ['approved', 'pending'], default: 'approved' },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    promotionUntil: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    verificationNote: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    price: { type: Number, required: true, min: 0 },
    curriculum: { type: [curriculumItemSchema], default: [] },
    deliveryFormat: { type: String, enum: ['self-paced', 'live'], default: 'self-paced' },
    format: { type: String, enum: ['self-paced-videos', 'live-cohort', 'pdf-ebook'], default: null },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: null },
    duration: { type: String, default: '' },
    scheduledDiscount: { type: scheduledDiscountSchema, default: null },
    refundable: { type: Boolean, default: false },
    refundConditions: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Course = mongoose.model('Course', courseSchema);
