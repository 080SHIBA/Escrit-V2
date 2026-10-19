import mongoose from 'mongoose';

const kycSubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  legalName: { type: String, required: true, trim: true, maxlength: 120 },
  dob: { type: Date, required: true },
  idType: { type: String, enum: ['nin', 'drivers-license', 'passport', 'voters-card'], required: true },
  idNumber: { type: String, required: true, select: false },
  idFrontPublicId: { type: String, required: true, select: false },
  idFrontResourceType: { type: String, required: true, select: false },
  idFrontFormat: { type: String, required: true, select: false },
  idBackPublicId: { type: String, default: null, select: false },
  idBackResourceType: { type: String, default: null, select: false },
  idBackFormat: { type: String, default: null, select: false },
  selfiePublicId: { type: String, required: true, select: false },
  selfieResourceType: { type: String, required: true, select: false },
  selfieFormat: { type: String, required: true, select: false },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], required: true, default: 'pending' },
  reviewReason: { type: String, default: '', maxlength: 500 },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

export const KycSubmission = mongoose.model('KycSubmission', kycSubmissionSchema);
