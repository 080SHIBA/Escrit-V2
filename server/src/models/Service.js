import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const servicePackageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 48 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    priceNaira: { type: Number, min: 100, required: true },
    deliveryDays: { type: Number, min: 1, max: 365, default: 7 },
    revisionCount: { type: Number, min: 0, max: 20, default: 0 },
    deliverables: { type: [String], default: [] },
  },
  { _id: false }
);

const serviceAddOnSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 48 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    priceNaira: { type: Number, min: 100, required: true },
  },
  { _id: false }
);

const buyerRequirementSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 48 },
    label: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: ['short_text', 'long_text', 'single_select', 'multi_select', 'file', 'link'], required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
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
    summary: { type: String, trim: true, maxlength: 240, default: '' },
    description: { type: String, default: '' },
    subcategory: { type: String, trim: true, maxlength: 80, default: '' },
    serviceModel: { type: String, enum: ['appointment', 'fixed_scope', 'custom_quote'], default: 'appointment', index: true },
    packages: { type: [servicePackageSchema], default: [] },
    addOns: { type: [serviceAddOnSchema], default: [] },
    blockedDates: {
      type: [{ startAt: { type: Date, required: true }, endAt: { type: Date, required: true } }],
      default: [],
    },
    maxRevisions: { type: Number, min: 0, max: 20, default: 1 },
    reservationMinutes: { type: Number, min: 5, max: 1440, default: 30 },
    images: { type: [String], default: [] },
    category: { type: String, default: 'General' },
    categoryReviewStatus: { type: String, enum: ['approved', 'pending'], default: 'approved' },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
    isFeatured: { type: Boolean, default: false },
    promotionUntil: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    verificationNote: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    basePrice: { type: Number, default: 0, min: 0 },
    startingPrice: { type: Number, default: 0, min: 0 },
    pricingUnit: { type: String, default: 'project' },
    estimatedTime: { type: String, default: '1-2 weeks' },
    location: { type: String, default: 'Remote' },
    deliveryMode: { type: String, enum: ['remote', 'in-person', 'hybrid'], default: 'remote' },
    deliveryMethods: { type: [String], enum: ['online', 'provider_location', 'buyer_location', 'remote_deliverable'], default: [] },
    serviceRadiusKm: { type: Number, min: 0, default: 0 },
    serviceArea: { type: String, trim: true, maxlength: 240, default: '' },
    travelFeeNaira: { type: Number, min: 0, default: 0 },
    durationMinutes: { type: Number, min: 15, default: 60 },
    bookingLeadTimeHours: { type: Number, min: 0, default: 24 },
    maxAdvanceBookingDays: { type: Number, min: 1, max: 730, default: 90 },
    slotCapacity: { type: Number, min: 1, max: 100, default: 1 },
    bufferMinutes: { type: Number, min: 0, max: 1440, default: 0 },
    maxBookingsPerDay: { type: Number, min: 1, default: 4 },
    instantConfirmation: { type: Boolean, default: false },
    timeZone: { type: String, default: 'Africa/Lagos' },
    availability: { type: [availabilitySchema], default: [] },
    deliverables: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    buyerRequirements: { type: [buyerRequirementSchema], default: [] },
    exclusions: { type: [String], default: [] },
    responseTimeHours: { type: Number, min: 1, max: 720, default: 48 },
    completionConditions: { type: String, trim: true, maxlength: 2000, default: '' },
    quoteExpiryDays: { type: Number, min: 1, max: 90, default: 7 },
    cancellationPolicy: { type: String, enum: ['flexible', 'moderate', 'strict', 'custom'], default: 'moderate' },
    cancellationTerms: { type: String, default: '' },
    reschedulePolicy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Service = mongoose.model('Service', serviceSchema);
