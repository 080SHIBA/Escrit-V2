// Server-backed autosave for any form. See models/FormDraft.js for the why.
import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { FormDraft } from '../models/FormDraft.js';

export const draftsRouter = Router();
draftsRouter.use(requireAuth);

// WHAT: a limiter just for drafts.
// WHY separate: autosave fires every few seconds while someone types, far more
// often than login or upload calls, so the shared limiters would block real use.
// It is still capped so a broken client cannot hammer the database.
draftsRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Autosave is paused for a moment. Your changes are kept on this device.' },
}));

const DRAFT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
// WHY 200 KB: plenty for long text fields (course outlines) and far below
// anything that could strain the database. Files are never stored here, only
// their URLs.
const MAX_DRAFT_BYTES = 200 * 1024;

// WHY a strict key pattern: the key becomes part of a database query, so only
// plain slugs (letters, digits, - _ : .) are accepted.
const keySchema = Joi.string().pattern(/^[a-z0-9][a-z0-9:_.-]{0,79}$/i).required();

// WHAT: field names that must never be written to a draft, at any depth.
// WHY: a draft is plaintext convenience data. Secrets belong nowhere but the
// request that needs them. The client hook also excludes these; checking here
// too means a buggy or malicious client cannot persist them.
const FORBIDDEN_WORDS = new Set(['password', 'passcode', 'pin', 'pincode', 'otp', 'cvv', 'cvc', 'secret', 'token', 'cardnumber']);

// WHY compare whole words instead of searching for substrings: "pin" is inside
// "shipping" and "otp" is inside "footprint", so a substring test would silently
// drop ordinary fields. Splitting "shippingAddress" into [shipping, address] and
// "pinCode" into [pin, code] matches only what we mean.
function isForbiddenField(name) {
  const words = String(name)
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .filter(Boolean);
  return words.some((word) => FORBIDDEN_WORDS.has(word));
}

function stripForbidden(value) {
  if (Array.isArray(value)) return value.map(stripForbidden);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([name]) => !isForbiddenField(name))
        .map(([name, inner]) => [name, stripForbidden(inner)]),
    );
  }
  return value;
}

const saveSchema = Joi.object({
  data: Joi.object().unknown(true).required(),
  clientUpdatedAt: Joi.date().iso().required(),
});

draftsRouter.get('/:key', asyncHandler(async (req, res) => {
  const { error, value: formKey } = keySchema.validate(req.params.key);
  if (error) throw new AppError(400, 'Unknown form.');
  const draft = await FormDraft.findOne({ userId: req.sellerId, formKey }).lean();
  // WHY 200 with null (not 404): "no draft yet" is the normal first-visit case,
  // not an error, and a 404 would show up as a red failure in the browser console.
  res.json({ draft: draft ? { data: draft.data, updatedAt: draft.clientUpdatedAt } : null });
}));

draftsRouter.put('/:key', asyncHandler(async (req, res) => {
  const keyResult = keySchema.validate(req.params.key);
  if (keyResult.error) throw new AppError(400, 'Unknown form.');
  const { error, value } = saveSchema.validate(req.body);
  if (error) throw new AppError(400, 'That draft could not be saved.');
  const data = stripForbidden(value.data);
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_DRAFT_BYTES) {
    throw new AppError(413, 'This draft is too large to autosave.');
  }
  const formKey = keyResult.value;
  const clientUpdatedAt = new Date(value.clientUpdatedAt);

  // WHAT: only overwrite when this edit is newer than what is stored.
  // WHY: two devices (or a delayed request) can race. The filter makes the database
  // itself reject an older edit, so a stale tab can never wipe newer work. If no
  // document matches and one already exists, the unique index raises a duplicate
  // key error, which we translate to "kept the newer one".
  try {
    await FormDraft.findOneAndUpdate(
      { userId: req.sellerId, formKey, clientUpdatedAt: { $lte: clientUpdatedAt } },
      { $set: { data, clientUpdatedAt, expiresAt: new Date(Date.now() + DRAFT_TTL_MS) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ saved: true });
  } catch (cause) {
    if (cause?.code === 11000) {
      const current = await FormDraft.findOne({ userId: req.sellerId, formKey }).lean();
      return res.json({ saved: false, draft: current ? { data: current.data, updatedAt: current.clientUpdatedAt } : null });
    }
    throw cause;
  }
}));

draftsRouter.delete('/:key', asyncHandler(async (req, res) => {
  const { error, value: formKey } = keySchema.validate(req.params.key);
  if (error) throw new AppError(400, 'Unknown form.');
  await FormDraft.deleteOne({ userId: req.sellerId, formKey });
  res.json({ cleared: true });
}));
