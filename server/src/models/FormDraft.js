import mongoose from 'mongoose';

// WHAT: one saved, half-filled form per (user, form key).
//
// WHY a single generic collection: every form in the app (KYC, profile, offers,
// course authoring...) needs the same thing, "remember what I typed, on any
// device". One small model plus one hook on the client covers all of them, so a
// new form gets autosave by choosing a key instead of needing its own table and
// routes.
//
// `data` is free-form on purpose: each form owns its own shape. The route limits
// its size and strips fields that must never be stored (passwords, PINs, OTPs).
const formDraftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // e.g. "kyc", "profile", "listing:course:new". Validated by the route.
  formKey: { type: String, required: true, maxlength: 80 },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  // WHAT: the moment (in the browser's clock) of the edit that produced `data`.
  // WHY: when a phone and a laptop both hold edits, the later edit should win.
  // Server time alone cannot decide that, because a request that was delayed by a
  // bad connection would arrive "newer" than an edit made after it.
  clientUpdatedAt: { type: Date, default: Date.now },
  // WHAT: when MongoDB may delete this draft (TTL index below).
  // WHY: abandoned drafts should not live forever. Every save pushes it out 90 days,
  // so a form someone returns to monthly is kept and a forgotten one is cleaned up.
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// WHY unique: exactly one draft per user per form; saving is an upsert.
formDraftSchema.index({ userId: 1, formKey: 1 }, { unique: true });
// WHY expireAfterSeconds 0: delete at the moment stored in expiresAt.
formDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const FormDraft = mongoose.model('FormDraft', formDraftSchema);
