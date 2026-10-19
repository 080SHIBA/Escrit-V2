// The seller account. Buyers never have one: checkout needs no signup.
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const bankAccountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, required: true },
    bankCode: { type: String, required: true },
    bankName: { type: String, required: true },
    // Account holder name returned by the bank lookup. Shown to buyers as
    // proof the payout destination is real.
    resolvedAccountName: { type: String, required: true },
  },
  { _id: false }
);

const savedListingSchema = new mongoose.Schema(
  {
    listingType: { type: String, enum: ['product', 'course', 'service'], required: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
  {
    listingType: { type: String, enum: ['product', 'course', 'service'], required: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, required: true },
    quantity: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const onboardingSchema = new mongoose.Schema(
  {
    goals: { type: [{ type: String, enum: ['Buy', 'Sell', 'Escrow'] }], default: [] },
    interests: { type: [{ type: String, enum: ['Products', 'Courses', 'Services'] }], default: [] },
    categories: {
      type: [{
        type: String,
        enum: ['Fashion', 'Electronics', 'Home & living', 'Beauty & health', 'Food & groceries', 'Digital goods', 'Design services', 'Tech services'],
      }],
      default: [],
    },
    city: { type: String, default: '', trim: true, maxlength: 100 },
    sellerTypes: { type: [{ type: String, enum: ['Products', 'Courses', 'Services'] }], default: [] },
    displayName: { type: String, default: '', trim: true, maxlength: 80 },
    fulfilmentDefault: { type: String, enum: ['', 'delivery', 'pickup', 'both'], default: '' },
    verificationIntent: {
      identity: { type: String, enum: ['', 'soon', 'planned', 'later'], default: '' },
      bank: { type: String, enum: ['', 'soon', 'planned', 'later'], default: '' },
    },
    currentStep: {
      type: String,
      enum: ['welcome', 'buy', 'sell1', 'sell2', 'sell3', 'escrow', 'trust', 'done', 'return', 'escrow-welcome', 'escrow-preview'],
      default: 'welcome',
    },
    flow: { type: String, enum: ['new-user', 'escrow-link'], default: 'new-user' },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const escrowReturnSchema = new mongoose.Schema(
  {
    linkId: { type: String, required: true },
    transactionId: { type: String, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Null for Google-only accounts.
    passwordHash: { type: String, default: null },
    businessName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['user', 'admin', 'owner'], default: 'user' },
    isDemoSeed: { type: Boolean, default: false },
    fullName: { type: String, default: '' },
    accountIntents: {
      type: [{ type: String, enum: ['Buy', 'Sell', 'Escrow links'] }],
      default: [],
    },
    onboarding: { type: onboardingSchema, default: () => ({}) },
    pendingEscrowReturn: { type: escrowReturnSchema, default: null },
    escrowRecipientPromptEligible: { type: Boolean, default: false },
    escrowRecipientPromptShownAt: { type: Date, default: null },
    displayName: { type: String, default: '' },
    phone: { type: String, default: '' },
    city: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    nin: { type: String, default: '' },
    profilePictureUrl: { type: String, default: '' },
    idDocumentUrl: { type: String, default: '' },
    kycStatus: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    kycReviewNote: { type: String, default: '' },
    kycReviewedAt: { type: Date, default: null },
    bankAccount: { type: bankAccountSchema, default: null },
    cartItems: { type: [cartItemSchema], default: [] },
    favoriteListings: { type: [savedListingSchema], default: [] },
    promoCreditsKobo: { type: Number, min: 0, default: 0 },

    // Sparse so many email/password accounts can share a null googleId.
    googleId: { type: String },

    // True at once for Google accounts; email sign-ups verify with an OTP.
    emailVerified: { type: Boolean, default: false },
    otpCodeHash: { type: String, default: null, select: false },
    otpExpiresAt: { type: Date, default: null, select: false },
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationTokenExpiresAt: { type: Date, default: null, select: false },

    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

// Strip secrets from every API response. `isAdmin` is derived from
// ADMIN_EMAILS so the client can show the disputes link; the admin routes
// enforce access server-side regardless.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.nin;
    delete ret.idDocumentUrl;
    delete ret.otpCodeHash;
    delete ret.otpExpiresAt;
    delete ret.emailVerificationTokenHash;
    delete ret.emailVerificationTokenExpiresAt;
    delete ret.resetTokenHash;
    delete ret.resetTokenExpiresAt;
    ret.isAdmin = ['admin', 'owner'].includes(ret.role) || env.adminEmails.includes(String(ret.email).toLowerCase());
    ret.isOwner = ret.role === 'owner' || env.ownerEmails.includes(String(ret.email).toLowerCase());
    return ret;
  },
});

// A plain `sparse` index still indexes an explicit null, so the second email sign-up
// failed with E11000 (googleId: null). A partial index only covers real string IDs.
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } }, name: 'googleId_unique_string' },
);
userSchema.index(
  { emailVerificationTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { emailVerificationTokenHash: { $type: 'string' } },
    name: 'email_verification_token_hash_unique',
  },
);

export const User = mongoose.model('User', userSchema);
