import mongoose from 'mongoose';

const scheduledDiscountSchema = new mongoose.Schema(
  {
    percent: { type: Number, min: 1, max: 100, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { _id: false }
);

const deliveryOptionSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['pickup', 'seller_delivery'], required: true },
    fee: { type: Number, min: 0, default: 0 },
    details: { type: String, maxlength: 240, default: '' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
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
    stock: { type: Number, default: 1, min: 0 },
    condition: { type: String, enum: ['new', 'used', 'refurbished'], default: 'new' },
    fulfillmentMethod: { type: String, enum: ['delivery', 'pickup', 'delivery-or-pickup', 'digital-download'], default: null },
    negotiable: { type: Boolean, default: false },
    refundable: { type: Boolean, default: false },
    deliveryOptions: { type: [deliveryOptionSchema], default: [{ method: 'pickup', fee: 0 }] },
    scheduledDiscount: { type: scheduledDiscountSchema, default: null },
    externalSource: { type: String, enum: ['shopify'], default: null },
    externalShopDomain: { type: String, default: null },
    externalProductId: { type: String, default: null },
    externalVariantId: { type: String, default: null },
  },
  { timestamps: true }
);

productSchema.index(
  { externalShopDomain: 1, externalVariantId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalSource: 'shopify', externalVariantId: { $type: 'string' } },
  }
);

export const Product = mongoose.model('Product', productSchema);
