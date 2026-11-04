import mongoose from 'mongoose';

const creditPurchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    credits: { type: Number, required: true },
    amountKobo: { type: Number, required: true },
    paymentProvider: { type: String, enum: ['paystack', 'flutterwave'], default: 'paystack' },
    paymentReference: { type: String, required: true, unique: true, index: true },
    paymentProviderTransactionId: { type: String, default: null },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const CreditPurchase = mongoose.model('CreditPurchase', creditPurchaseSchema);

