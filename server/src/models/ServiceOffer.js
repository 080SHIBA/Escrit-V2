import mongoose from 'mongoose';

const offerEventSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['proposed', 'countered', 'accepted', 'rejected'], required: true },
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
    status: { type: String, enum: ['PROPOSED', 'COUNTERED', 'ACCEPTED', 'REJECTED'], default: 'PROPOSED', index: true },
    currentPriceKobo: { type: Number, min: 10000, required: true },
    paymentMode: { type: String, enum: ['escrow', 'direct'], default: 'escrow' },
    directPaymentRiskAcceptedAt: { type: Date, default: null },
    agreedPriceKobo: { type: Number, min: 10000, default: null },
    fulfilmentCriteria: { type: String, trim: true, minlength: 5, maxlength: 2000, required: true },
    appointmentAt: { type: Date, default: null },
    counterCount: { type: Number, default: 0, min: 0, max: 1 },
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', default: null },
    acceptedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', default: null },
    offerHistory: { type: [offerEventSchema], default: [] },
  },
  { timestamps: true }
);

export const ServiceOffer = mongoose.model('ServiceOffer', serviceOfferSchema);