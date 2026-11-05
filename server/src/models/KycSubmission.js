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
  selfiePublicId: { type: String, default: null, select: false },
  selfieResourceType: { type: String, default: null, select: false },
  selfieFormat: { type: String, default: null, select: false },
  // WHAT: proof that a live person passed the prompted face check (blink, mouth, head turn).
  // WHY instead of a selfie photo: the check is registered the moment the prompts succeed,
  // with no extra picture. selfie* above stay for older submissions and are now optional.
  liveness: {
    sessionId: { type: String, default: null, index: { unique: true, sparse: true } },
    steps: { type: [String], default: [] },
    totalMs: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
  },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], required: true, default: 'pending' },
  reviewReason: { type: String, default: '', maxlength: 500 },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

export const KycSubmission = mongoose.model('KycSubmission', kycSubmissionSchema);
