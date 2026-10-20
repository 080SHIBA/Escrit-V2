import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
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
    basePrice: { type: Number, default: 0, min: 0 },
    pricingUnit: { type: String, default: 'project' },
    estimatedTime: { type: String, default: '1-2 weeks' },
    location: { type: String, default: 'Remote' },
    deliveryMode: { type: String, enum: ['remote', 'in-person', 'hybrid'], default: 'remote' },
    serviceRadiusKm: { type: Number, min: 0, default: 0 },
    durationMinutes: { type: Number, min: 15, default: 60 },
    bookingLeadTimeHours: { type: Number, min: 0, default: 24 },
    maxBookingsPerDay: { type: Number, min: 1, default: 4 },
    timeZone: { type: String, default: 'Africa/Lagos' },
    availability: { type: [availabilitySchema], default: [] },
    deliverables: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    cancellationPolicy: { type: String, enum: ['flexible', 'moderate', 'strict', 'custom'], default: 'moderate' },
    cancellationTerms: { type: String, default: '' },
    reschedulePolicy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Service = mongoose.model('Service', serviceSchema);
