import mongoose from 'mongoose';

const shopifyOAuthStateSchema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shopDomain: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const ShopifyOAuthState = mongoose.model('ShopifyOAuthState', shopifyOAuthStateSchema);
