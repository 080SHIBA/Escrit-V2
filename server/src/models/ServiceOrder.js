import mongoose from 'mongoose';

const serviceOrderEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const deliverableSchema = new mongoose.Schema(
  {
    url: { type: String, default: '', maxlength: 1000 },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    assetPublicId: { type: String, default: '', maxlength: 500 },
    resourceType: { type: String, enum: ['image', 'raw', ''], default: '' },
    format: { type: String, default: '', maxlength: 32 },
    mimeType: { type: String, default: '', maxlength: 120 },
    fileName: { type: String, default: '', maxlength: 180 },
    sizeBytes: { type: Number, min: 0, max: 10 * 1024 * 1024, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const serviceOrderSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['appointment', 'fixed_scope', 'quote'], required: true },
    status: {
      type: String,
      enum: [
        'pending_approval',
        'awaiting_payment',
        'ready_to_start',
        'confirmed',
        'in_progress',
        'delivered',
        'revision_requested',
        'accepted',
        'completed',
        'declined',
        'cancelled',
        'disputed',
      ],
      required: true,
      index: true,
    },
    paymentStatus: { type: String, enum: ['unpaid', 'processing', 'paid', 'failed', 'refunded'], default: 'unpaid', index: true },
    paymentMode: { type: String, enum: ['escrow', 'direct'], required: true },
    checkoutLinkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', default: null },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null, index: true },
    authorizationUrl: { type: String, default: '' },
    appointmentAt: { type: Date, default: null, index: true },
    requestedAppointmentAt: { type: Date, default: null },
    capacityDate: { type: String, default: '' },
    durationMinutes: { type: Number, min: 15, default: null },
    bufferMinutes: { type: Number, min: 0, max: 1440, default: 0 },
    reservationMinutes: { type: Number, min: 5, max: 1440, default: 30 },
    timeZone: { type: String, default: '' },
    deliveryMethod: { type: String, enum: ['online', 'provider_location', 'buyer_location', 'remote_deliverable', ''], default: '' },
    location: { type: String, trim: true, maxlength: 500, default: '' },
    details: { type: String, trim: true, maxlength: 5000, default: '' },
    packageSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    addOnsSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] },
    buyerRequirementsSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] },
    buyerResponses: { type: mongoose.Schema.Types.Mixed, default: {} },
    quoteSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    amountKobo: { type: Number, min: 10000, required: true },
    termsSnapshot: { type: String, required: true, maxlength: 10000 },
    termsAcceptedAt: { type: Date, required: true },
    directPaymentRiskAcceptedAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true },
    reservationActive: { type: Boolean, default: false },
    reservationExpiresAt: { type: Date, default: null, index: true },
    slotKeys: { type: [String], default: [] },
    deliverables: { type: [deliverableSchema], default: [] },
    deliveryNote: { type: String, trim: true, maxlength: 1000, default: '' },
    revisionCount: { type: Number, min: 0, default: 0 },
    maxRevisions: { type: Number, min: 0, default: 0 },
    events: { type: [serviceOrderEventSchema], default: [] },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

serviceOrderSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true });
serviceOrderSchema.index(
  { sellerId: 1, slotKeys: 1 },
  { unique: true, partialFilterExpression: { reservationActive: true } }
);

export const ServiceOrder = mongoose.model('ServiceOrder', serviceOrderSchema);
