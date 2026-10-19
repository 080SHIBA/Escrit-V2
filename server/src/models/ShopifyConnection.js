import mongoose from 'mongoose';

const shopifyConnectionSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    shopDomain: { type: String, required: true, unique: true },
    accessTokenCiphertext: { type: String, required: true },
    accessTokenIv: { type: String, required: true },
    accessTokenTag: { type: String, required: true },
    accessTokenExpiresAt: { type: Date, default: null },
    refreshTokenCiphertext: { type: String, default: null },
    refreshTokenIv: { type: String, default: null },
    refreshTokenTag: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    productCursor: { type: String, default: null },
    lastProductSyncAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ShopifyConnection = mongoose.model('ShopifyConnection', shopifyConnectionSchema);
