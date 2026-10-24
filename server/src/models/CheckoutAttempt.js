import mongoose from 'mongoose';

const checkoutAttemptSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    status: { type: String, enum: ['initializing', 'pending', 'confirmed', 'failed'], default: 'initializing' },
    amountKobo: { type: Number, required: true },
    requestHash: { type: String, default: '' },
    paymentProvider: { type: String, enum: ['paystack', 'flutterwave'], required: true },
    authorizationUrl: { type: String, default: '' },
    transactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

checkoutAttemptSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true });

export const CheckoutAttempt = mongoose.model('CheckoutAttempt', checkoutAttemptSchema);
