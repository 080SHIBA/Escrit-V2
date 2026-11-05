// One buyer's checkout against a Link, and the home of the escrow state
// machine. `status` only moves forward through services/escrow.js and is
// never set from client input. A link can have many transactions open at
// once, each resolved independently.
import mongoose from 'mongoose';
import { generateDeliveryCode, generateTrackingCode } from '../services/deliveryCodes.js';
import { DEFAULT_RELEASE_WINDOW_HOURS, RELEASE_WINDOW_OPTIONS } from '../shared/releaseConditions.js';

const releaseWindowValues = RELEASE_WINDOW_OPTIONS.map(({ hours }) => hours);

export const TX_STATUS = Object.freeze({
  CREATED: 'CREATED',
  PAID_HELD: 'PAID_HELD',
  DIRECT_PAID: 'DIRECT_PAID',
  DIRECT_COMPLETED: 'DIRECT_COMPLETED',
  RELEASED: 'RELEASED',
  DISPUTED: 'DISPUTED',
  RESOLVED_RELEASED: 'RESOLVED_RELEASED',
  RESOLVED_CREDITED: 'RESOLVED_CREDITED',
  RESOLVED_REFUNDED: 'RESOLVED_REFUNDED',
});

// WHAT: one entry in an order's delivery timeline.
// WHY its own schema: deliveries here are person-to-person (no central courier), so each seller
// posts progress for their own order, and each order keeps its own history and arrival estimate.
const trackingEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    status: { type: String, required: true, maxlength: 30 },
    note: { type: String, default: '', maxlength: 300 },
    // 'seller' = posted by the seller; 'system' = created by Escrit; 'buyer' = the buyer's signature.
    source: { type: String, enum: ['seller', 'system', 'buyer'], default: 'seller' },
  },
  { _id: false }
);

const payoutLogEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String, required: true }, // e.g. "transfer_initiated", "transfer_success", "refund_issued"
    detail: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const evidenceEntrySchema = new mongoose.Schema(
  {
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    party: { type: String, enum: ['buyer', 'seller'], required: true },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    mediaUrl: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const transactionSchema = new mongoose.Schema(
  {
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', required: true, index: true },

    status: {
      type: String,
      enum: Object.values(TX_STATUS),
      default: TX_STATUS.CREATED,
      index: true,
    },

    paymentProvider: { type: String, enum: ['paystack', 'flutterwave'], default: 'paystack' },
    paymentReference: { type: String, default: null, index: true },
    checkoutAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'CheckoutAttempt', default: null, index: true },
    serviceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', default: null, index: true },
    serviceOrderKind: { type: String, enum: ['appointment', 'fixed_scope', 'quote', null], default: null },
    checkoutMode: { type: String, enum: ['escrow', 'direct'], default: 'escrow' },
    directInventoryReserved: { type: Boolean, default: false },
    checkoutTotalKobo: { type: Number, default: null },
    buyerPriceKoboSnapshot: { type: Number, default: null },
    sellerPayoutBaseKobo: { type: Number, default: null },
    checkoutQuantity: { type: Number, min: 1, default: 1 },
    paymentProviderTransactionId: { type: String, default: null },
    buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    buyerEmail: { type: String, default: null },
    buyerPhone: { type: String, default: null },
    termsAcceptedAt: { type: Date, default: null },
    termsSnapshot: { type: String, default: '' },
    deliveryAddressSnapshot: { type: String, default: '' },
    releaseWindowHours: { type: Number, enum: releaseWindowValues, default: DEFAULT_RELEASE_WINDOW_HOURS },

    fulfillmentStatus: {
      type: String,
      enum: ['NOT_STARTED', 'IN_TRANSIT', 'READY_FOR_MEETING', 'DELIVERED', 'SERVICE_COMPLETE', 'BUYER_NO_SHOW'],
      default: 'NOT_STARTED',
    },
    trackingReference: { type: String, default: '' },
    // WHAT: Escrit's own tracking code for this order, e.g. ESC-K7QM-4XB2.
    // WHY: it exists from the moment the order is made, so the buyer always has a code to quote,
    // even when the seller never posts an update. Unique so one code is one order.
    trackingCode: { type: String, default: undefined, index: { unique: true, sparse: true } },
    // WHAT: an 8-digit numeric code used only for USSD signing.
    // WHY separate: USSD sessions on many phones accept digits only, so the letter-based tracking
    // code could not be typed. Signing also needs the buyer's PIN and phone, so the digits alone grant nothing.
    deliveryCode: { type: String, default: undefined, index: { unique: true, sparse: true } },
    estimatedArrivalAt: { type: Date, default: null },
    trackingEvents: { type: [trackingEventSchema], default: [] },
    // WHAT: proof that the buyer personally confirmed receipt, and how.
    // method: 'face' (live face check), 'device' (fingerprint/face unlock via WebAuthn), 'ussd' (PIN).
    deliverySignature: {
      method: { type: String, enum: ['face', 'device', 'ussd', null], default: null },
      signedAt: { type: Date, default: null },
      // Each liveness session can sign once; unique + sparse enforces that across the database.
      livenessSessionId: { type: String, default: undefined, index: { unique: true, sparse: true } },
      credentialId: { type: String, default: '' },
      phoneLast4: { type: String, default: '' },
    },
    fulfillmentNote: { type: String, default: '' },
    deliveryProofUrl: { type: String, default: '' },
    fulfillmentUpdatedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    releaseDueAt: { type: Date, default: null, index: true },
    buyerNoShowAt: { type: Date, default: null },
    noShowResponseDueAt: { type: Date, default: null },
    buyerNoShowReason: { type: String, default: null },

    paidAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    payoutState: { type: String, enum: ['idle', 'processing', 'completed', 'failed'], default: 'idle' },
    payoutProcessingAt: { type: Date, default: null },
    refundState: { type: String, enum: ['idle', 'processing', 'completed', 'failed'], default: 'idle' },
    refundProcessingAt: { type: Date, default: null },

    disputeReason: { type: String, default: null },
    evidence: { type: [evidenceEntrySchema], default: [] },
    complaintLogged: { type: Boolean, default: false },
    complaintReason: { type: String, default: '' },
    disputeRaisedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    // Plain-language reason for a dispute outcome, shown to both parties.
    // Deliberately anonymous: it is attributed to the review team, never
    // to an individual admin.
    resolutionNote: { type: String, default: null },

    payoutLog: { type: [payoutLogEntrySchema], default: [] },
  },
  { timestamps: true }
);

// WHAT: give every new order its tracking code and delivery code.
// WHY a hook: orders are created in several places (cart checkout, direct checkout, services).
// Doing it once here guarantees none of them can forget, with no changes needed in each route.
transactionSchema.pre('validate', function assignDeliveryCodes(next) {
  if (this.isNew) {
    if (!this.trackingCode) this.trackingCode = generateTrackingCode();
    if (!this.deliveryCode) this.deliveryCode = generateDeliveryCode();
  }
  next();
});

export const Transaction = mongoose.model('Transaction', transactionSchema);
