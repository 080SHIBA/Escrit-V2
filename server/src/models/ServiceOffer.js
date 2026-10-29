import mongoose from 'mongoose';

const offerEventSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['requested', 'quoted', 'countered', 'accepted', 'rejected', 'changes_requested'], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    priceKobo: { type: Number, min: 0, default: null },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const serviceOfferSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationKey: { type: String, default: null },
    paymentOptionsSnapshot: {
      escrow: { type: Boolean, default: true },
      direct: { type: Boolean, default: false },
    },
    status: { type: String, enum: ['REQUESTED', 'QUOTED', 'CHANGES_REQUESTED', 'PROPOSED', 'COUNTERED', 'ACCEPTED', 'REJECTED'], default: 'REQUESTED', index: true },
    currentPriceKobo: { type: Number, min: 10000, default: null },
    paymentMode: { type: String, enum: ['escrow', 'direct'], default: 'escrow' },
    directPaymentRiskAcceptedAt: { type: Date, default: null },
    agreedPriceKobo: { type: Number, min: 10000, default: null },
    fulfilmentCriteria: { type: String, trim: true, minlength: 5, maxlength: 5000, required: true },
    projectRequest: {
      description: { type: String, trim: true, maxlength: 5000, default: '' },
      budgetKobo: { type: Number, min: 0, default: null },
      deadline: { type: Date, default: null },
      location: { type: String, trim: true, maxlength: 500, default: '' },
      attachments: { type: [String], default: [] },
    },
    quoteSnapshot: {
      scope: { type: String, trim: true, maxlength: 5000, default: '' },
      deliverables: { type: [String], default: [] },
      amountKobo: { type: Number, min: 10000, default: null },
      currency: { type: String, enum: ['NGN'], default: 'NGN' },
      timeline: { type: String, trim: true, maxlength: 500, default: '' },
      deadline: { type: Date, default: null },
      revisionLimit: { type: Number, min: 0, max: 20, default: 0 },
      milestones: { type: [mongoose.Schema.Types.Mixed], default: [] },
      paymentTerms: { type: String, trim: true, maxlength: 2000, default: '' },
      expiresAt: { type: Date, default: null },
      sentAt: { type: Date, default: null },
    },
    changeRequest: {
      note: { type: String, trim: true, maxlength: 1000, default: '' },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      status: { type: String, enum: ['none', 'requested', 'accepted'], default: 'none' },
      acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      requestedAt: { type: Date, default: null },
      acceptedAt: { type: Date, default: null },
    },
    appointmentAt: { type: Date, default: null },
    counterCount: { type: Number, default: 0, min: 0, max: 1 },
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', default: null },
    acceptedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', default: null },
    offerHistory: { type: [offerEventSchema], default: [] },
    conversationReports: {
      type: [{
        reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, trim: true, maxlength: 1000, required: true },
        status: { type: String, enum: ['open', 'reviewed', 'closed'], default: 'open' },
        createdAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

serviceOfferSchema.index({ conversationKey: 1 }, { unique: true, sparse: true });

export const ServiceOffer = mongoose.model('ServiceOffer', serviceOfferSchema);