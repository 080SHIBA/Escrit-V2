import mongoose from 'mongoose';

const listingDraftSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  status: { type: String, enum: ['draft', 'live'], default: 'draft' },
  type: { type: String, enum: ['product', 'service', 'course'], default: 'product' },
  title: { type: String, default: '', maxlength: 80 },
  category: { type: String, default: '' },
  description: { type: String, default: '', maxlength: 1000 },
  price: { type: Number, default: 0, min: 0 },
  images: { type: [String], default: [] },
  allowOffers: { type: Boolean, default: false },
  paymentOptions: {
    escrow: { type: Boolean, default: true },
    direct: { type: Boolean, default: true },
  },
  overridesDefault: { type: Boolean, default: false },
  condition: { type: String, enum: ['new', 'used'], default: 'new' },
  fulfillment: { type: String, default: 'delivery' },
  fulfillmentOverridesDefault: { type: Boolean, default: false },
  quantity: { type: Number, default: 1, min: 1 },
  deliveryTime: { type: String, default: '' },
  format: { type: String, default: 'self-paced-videos' },
  level: { type: String, default: 'beginner' },
  duration: { type: String, default: '' },
}, { timestamps: true });

export const ListingDraft = mongoose.model('ListingDraft', listingDraftSchema);
