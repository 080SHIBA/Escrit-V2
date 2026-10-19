import mongoose from 'mongoose';

const sellerReportSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, trim: true, required: true, maxlength: 1000 },
    status: { type: String, enum: ['open', 'reviewed', 'closed'], default: 'open', index: true },
  },
  { timestamps: true }
);

sellerReportSchema.index({ sellerId: 1, createdAt: -1 });

export const SellerReport = mongoose.model('SellerReport', sellerReportSchema);
