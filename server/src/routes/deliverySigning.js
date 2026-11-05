// Receipt link + signing endpoints (face, device) and the buyer's signing setup (PIN, device).
import { Router } from 'express';
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { Link } from '../models/Link.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { parseReceiptToken, receiptToken } from '../services/deliveryCodes.js';
import { buildTimeline, hasSellerUpdates } from '../services/deliveryTracking.js';
import { signDelivery, signingBlockReason } from '../services/deliverySigning.js';
import { issueLivenessSession, verifyLivenessProof } from '../services/livenessSession.js';

export const receiptsRouter = Router();
export const signingSetupRouter = Router();
receiptsRouter.use(requireAuth);
signingSetupRouter.use(requireAuth);

// WHAT: the site identity WebAuthn binds credentials to.
// WHY derived from CLIENT_URL: a passkey only works on the exact site it was made for, which is what
// stops a look-alike phishing site from using it.
function relyingParty() {
  const url = new URL(env.clientUrl);
  return { rpID: url.hostname, origin: url.origin, rpName: 'Escrit' };
}

// WHAT: load the order for a receipt link and make sure the signed-in user is its buyer.
// WHY 404 for "not yours": the link alone must not reveal that an order exists to anyone else.
async function loadReceiptOrder(req) {
  const id = parseReceiptToken(req.params.token);
  if (!id) throw new AppError(404, 'This receipt link is not valid.');
  const transaction = await Transaction.findById(id);
  if (!transaction || String(transaction.buyerUserId) !== String(req.sellerId)) throw new AppError(404, 'This receipt link is not valid.');
  const link = await Link.findById(transaction.linkId);
  if (!link) throw new AppError(404, 'This receipt link is not valid.');
  return { transaction, link };
}

receiptsRouter.get('/:token', asyncHandler(async (req, res) => {
  const { transaction, link } = await loadReceiptOrder(req);
  const [user, seller] = await Promise.all([
    User.findById(req.sellerId).select('+webauthnCredentials +signingPin phone'),
    User.findById(link.sellerId).select('displayName businessName'),
  ]);
  res.json({
    receipt: {
      title: link.itemName,
      seller: seller?.displayName || seller?.businessName || 'Escrit seller',
      trackingCode: transaction.trackingCode,
      deliveryCode: transaction.deliveryCode,
      estimatedArrivalAt: transaction.estimatedArrivalAt,
      status: transaction.status,
      signed: Boolean(transaction.deliverySignature?.signedAt),
      signedAt: transaction.deliverySignature?.signedAt || null,
      signedMethod: transaction.deliverySignature?.method || null,
      blockReason: signingBlockReason(transaction, link),
      timeline: buildTimeline(transaction),
      sellerHasPosted: hasSellerUpdates(transaction),
      methods: {
        face: true,
        device: (user?.webauthnCredentials || []).length > 0,
        ussd: Boolean(user?.signingPin?.hash && user?.phone),
        ussdShortcode: process.env.USSD_SHORTCODE || '',
      },
    },
  });
}));

// ---- Face (live check) ----
receiptsRouter.post('/:token/liveness-session', asyncHandler(async (req, res) => {
  const { transaction, link } = await loadReceiptOrder(req);
  const reason = signingBlockReason(transaction, link);
  if (reason) throw new AppError(409, reason);
  const session = issueLivenessSession(req.sellerId, 'delivery');
  res.json({ token: session.token, steps: session.steps, expiresAt: session.expiresAt });
}));

receiptsRouter.post('/:token/sign/face', validate(Joi.object({ livenessToken: Joi.string().max(2000).required(), livenessProof: Joi.object().required() })), asyncHandler(async (req, res) => {
  const { transaction } = await loadReceiptOrder(req);
  const proof = verifyLivenessProof({ token: req.body.livenessToken, proof: req.body.livenessProof, userId: req.sellerId, purpose: 'delivery' });
  const signed = await signDelivery(transaction, { method: 'face', livenessSessionId: proof.sessionId, io: req.app.get('io') });
  res.json({ signed: true, signedAt: signed.deliverySignature.signedAt });
}));

// ---- Device (fingerprint / face unlock through WebAuthn) ----
receiptsRouter.post('/:token/device/options', asyncHandler(async (req, res) => {
  const { transaction, link } = await loadReceiptOrder(req);
  const reason = signingBlockReason(transaction, link);
  if (reason) throw new AppError(409, reason);
  const user = await User.findById(req.sellerId).select('+webauthnCredentials');
  if (!user?.webauthnCredentials?.length) throw new AppError(409, 'No device is registered for signing yet.');
  const options = await generateAuthenticationOptions({
    rpID: relyingParty().rpID,
    userVerification: 'required', // the phone must check the fingerprint/face, not just "tap"
    allowCredentials: user.webauthnCredentials.map((c) => ({ id: c.credentialId, transports: c.transports })),
  });
  user.webauthnChallenge = { value: options.challenge, purpose: `sign:${transaction._id}`, expiresAt: new Date(Date.now() + 5 * 60_000) };
  await user.save();
  res.json({ options });
}));

receiptsRouter.post('/:token/sign/device', validate(Joi.object({ response: Joi.object().required() })), asyncHandler(async (req, res) => {
  const { transaction } = await loadReceiptOrder(req);
  const user = await User.findById(req.sellerId).select('+webauthnCredentials +webauthnChallenge');
  const challenge = user?.webauthnChallenge;
  if (!challenge?.value || challenge.purpose !== `sign:${transaction._id}` || challenge.expiresAt < new Date()) {
    throw new AppError(400, 'The device check expired. Please try again.');
  }
  const credential = user.webauthnCredentials.find((c) => c.credentialId === req.body.response.id);
  if (!credential) throw new AppError(400, 'This device is not registered for signing.');
  const { origin, rpID } = relyingParty();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: req.body.response,
      expectedChallenge: challenge.value,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: credential.credentialId, publicKey: Buffer.from(credential.publicKey, 'base64url'), counter: credential.counter, transports: credential.transports },
    });
  } catch {
    throw new AppError(400, 'The device check failed. Please try again.');
  }
  if (!verification.verified) throw new AppError(400, 'The device check failed. Please try again.');
  credential.counter = verification.authenticationInfo.newCounter;
  user.webauthnChallenge = undefined; // one use only
  await user.save();
  const signed = await signDelivery(transaction, { method: 'device', credentialId: credential.credentialId, io: req.app.get('io') });
  res.json({ signed: true, signedAt: signed.deliverySignature.signedAt });
}));

// ---- Setup: signing PIN and device registration ----
signingSetupRouter.get('/', asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId).select('+webauthnCredentials +signingPin phone');
  res.json({
    hasPin: Boolean(user?.signingPin?.hash),
    hasPhone: Boolean(user?.phone),
    devices: (user?.webauthnCredentials || []).map((c) => ({ id: c.credentialId, label: c.label, createdAt: c.createdAt })),
  });
}));

// WHAT: set or change the USSD signing PIN. Requires the account password.
// WHY the password: the PIN can release funds, so changing it must prove it is really the owner.
signingSetupRouter.put('/pin', validate(Joi.object({ pin: Joi.string().pattern(/^\d{4,6}$/).required(), password: Joi.string().max(200).required() })), asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId).select('+passwordHash phone');
  const ok = user?.passwordHash && await bcrypt.compare(req.body.password, user.passwordHash);
  if (!ok) throw new AppError(403, 'Your password is not correct.');
  if (!user.phone) throw new AppError(409, 'Add your phone number to your profile first. USSD signing only works from that number.');
  // Reject trivially guessable PINs.
  if (/^(\d)\1+$/.test(req.body.pin) || '0123456789'.includes(req.body.pin) || '9876543210'.includes(req.body.pin)) {
    throw new AppError(400, 'Choose a PIN that is not a repeated or sequential number.');
  }
  await User.updateOne({ _id: user._id }, { $set: { signingPin: { hash: await bcrypt.hash(req.body.pin, 10), setAt: new Date(), failedAttempts: 0, lockedUntil: null } } });
  res.json({ hasPin: true });
}));

signingSetupRouter.post('/device/register-options', asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId).select('+webauthnCredentials email');
  const { rpID, rpName } = relyingParty();
  const options = await generateRegistrationOptions({
    rpName, rpID,
    userName: user.email,
    userID: new TextEncoder().encode(String(user._id)),
    attestationType: 'none', // we only need the public key, not proof of the device model
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    excludeCredentials: user.webauthnCredentials.map((c) => ({ id: c.credentialId, transports: c.transports })),
  });
  user.webauthnChallenge = { value: options.challenge, purpose: 'register', expiresAt: new Date(Date.now() + 5 * 60_000) };
  await user.save();
  res.json({ options });
}));

signingSetupRouter.post('/device/register', validate(Joi.object({ response: Joi.object().required(), label: Joi.string().trim().max(60).allow('') })), asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId).select('+webauthnCredentials +webauthnChallenge');
  const challenge = user?.webauthnChallenge;
  if (!challenge?.value || challenge.purpose !== 'register' || challenge.expiresAt < new Date()) throw new AppError(400, 'The setup expired. Please try again.');
  const { origin, rpID } = relyingParty();
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response: req.body.response, expectedChallenge: challenge.value, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  } catch {
    throw new AppError(400, 'This device could not be registered.');
  }
  if (!verification.verified) throw new AppError(400, 'This device could not be registered.');
  const { credential } = verification.registrationInfo;
  user.webauthnCredentials.push({ credentialId: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter, transports: credential.transports || [], label: req.body.label || 'This device' });
  user.webauthnChallenge = undefined;
  await user.save();
  res.json({ registered: true });
}));

export { receiptToken };
