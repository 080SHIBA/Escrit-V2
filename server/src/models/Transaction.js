// One buyer's checkout against a Link, and the home of the escrow state
// machine. `status` only moves forward through services/escrow.js and is
// never set from client input. A link can have many transactions open at
// once, each resolved independently.
import mongoose from 'mongoose';

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
    checkoutMode: { type: String, enum: ['escrow', 'direct'], default: 'escrow' },
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

    fulfillmentStatus: {
      type: String,
      enum: ['NOT_STARTED', 'IN_TRANSIT', 'READY_FOR_MEETING', 'DELIVERED', 'SERVICE_COMPLETE', 'BUYER_NO_SHOW'],
      default: 'NOT_STARTED',
    },
    trackingReference: { type: String, default: '' },
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

export const Transaction = mongoose.model('Transaction', transactionSchema);
