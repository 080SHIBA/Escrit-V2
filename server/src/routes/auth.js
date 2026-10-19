import { Router } from 'express';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  signAccessToken,
  signRefreshToken,
  setRefreshCookie,
  refreshCookieOptions,
  requireAuth,
} from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { verifyGoogleIdToken, isGoogleSignInConfigured } from '../services/googleAuth.js';
import { isEmailDeliveryConfigured, sendOtpEmail, sendPasswordResetEmail, sendVerificationEmail } from '../services/mailer.js';
import { recordFunnelEvent } from '../services/funnel.js';
import { escrowReturnPath, parseEscrowReturnTo } from '../utils/escrowReturn.js';
import {
  generateOtp,
  verifyOtp,
  generateResetToken,
  verifyResetToken,
  generateVerificationToken,
  hashVerificationToken,
  verifyVerificationToken,
} from '../utils/otp.js';

export const authRouter = Router();

// Signs both tokens and returns the same { accessToken, seller } shape
// for every login path (password, Google, registration).
async function issueSession(res, user) {
  const email = user.email.toLowerCase();
  if (env.ownerEmails.includes(email) && user.role !== 'owner') {
    user.role = 'owner';
    await user.save();
  } else if (env.adminEmails.includes(email) && user.role === 'user') {
    user.role = 'admin';
    await user.save();
  }
  const accessToken = signAccessToken(user.id);
  setRefreshCookie(res, signRefreshToken(user.id));
  return {
    accessToken,
    seller: user,
    returnTo: escrowReturnPath(user.pendingEscrowReturn),
  };
}

function applyEscrowReturn(user, returnTo) {
  if (!returnTo) return null;
  const target = parseEscrowReturnTo(returnTo);
  if (!target) throw new AppError(400, 'This transaction link is not valid. Open the link again and try signing in.');
  user.pendingEscrowReturn = target;
  user.onboarding = {
    ...user.onboarding?.toObject?.(),
    flow: 'escrow-link',
    currentStep: 'escrow-welcome',
    completed: false,
  };
  return target;
}

function recordAuthFunnelEvent(event, userId, target) {
  if (!target) return;
  recordFunnelEvent(event, {
    userId,
    linkId: target.linkId,
    transactionId: target.transactionId,
  }).catch((error) => console.error(`[funnel] could not record ${event}`, error.message));
}

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  businessName: Joi.string().min(2).max(80).required(),
  fullName: Joi.string().trim().min(2).max(120).required(),
  nin: Joi.string().trim().min(5).max(40).required(),
});

const signUpSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  fullName: Joi.string().trim().min(2).max(120).pattern(/^\S+(?:\s+\S+)+$/).required(),
  password: Joi.string().min(8).pattern(/[\d\p{P}\p{S}]/u).required(),
  intents: Joi.array().items(Joi.string().valid('Buy', 'Sell', 'Escrow links')).min(1).unique().required(),
  returnTo: Joi.string().pattern(/^\/(?:r|escrow)\/[a-f\d]{24}(?:\/t\/[a-f\d]{24})?$/i),
});

async function issueAndSendVerificationLink(user) {
  const { token, hash, expiresAt } = generateVerificationToken();
  user.emailVerificationTokenHash = hash;
  user.emailVerificationTokenExpiresAt = expiresAt;
  await user.save();
  const verificationUrl = `${env.clientUrl}/confirm-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail(user.email, verificationUrl);
}

authRouter.post('/sign-up', authLimiter, validate(signUpSchema), asyncHandler(async (req, res) => {
  if (!isEmailDeliveryConfigured()) {
    throw new AppError(503, 'Email verification is not configured. Please try again later.');
  }

  const { email, fullName, password, intents, returnTo } = req.body;
  if (await User.exists({ email })) {
    throw new AppError(409, 'An account with this email already exists');
  }

  let user;
  try {
    user = await User.create({
      email,
      fullName,
      businessName: fullName,
      accountIntents: intents,
      passwordHash: await bcrypt.hash(password, 12),
    });
    if (returnTo) {
      const target = applyEscrowReturn(user, returnTo);
      await user.save();
      recordAuthFunnelEvent('registration_completed', user._id, target);
    }
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'An account with this email already exists');
    throw error;
  }

  try {
    await issueAndSendVerificationLink(user);
  } catch (error) {
    console.error('[auth] failed to send verification email', error.message);
    throw new AppError(502, 'Your account was created, but we could not send the verification email');
  }

  res.status(201).json({ ...await issueSession(res, user), email: user.email, accountCreated: true });
}));

const resendVerificationSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
});

authRouter.post('/resend-verification', authLimiter, validate(resendVerificationSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || user.emailVerified) return res.json({ ok: true });
  if (!isEmailDeliveryConfigured()) {
    throw new AppError(503, 'Email verification is not configured. Please try again later.');
  }

  try {
    await issueAndSendVerificationLink(user);
  } catch (error) {
    console.error('[auth] failed to resend verification email', error.message);
    throw new AppError(502, 'We could not send the verification email. Please try again.');
  }
  res.json({ ok: true });
}));

const verifyEmailLinkSchema = Joi.object({
  token: Joi.string().length(64).pattern(/^[a-f0-9]+$/i).required(),
});

authRouter.post('/verify-email-link', authLimiter, validate(verifyEmailLinkSchema), asyncHandler(async (req, res) => {
  const { token } = req.body;
  const user = await User.findOne({ emailVerificationTokenHash: hashVerificationToken(token) })
    .select('+emailVerificationTokenHash +emailVerificationTokenExpiresAt');
  if (!user || !verifyVerificationToken(token, user.emailVerificationTokenHash, user.emailVerificationTokenExpiresAt)) {
    throw new AppError(400, 'This verification link is invalid or has expired. Request a new one and try again.');
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationTokenExpiresAt = null;
  user.otpCodeHash = null;
  user.otpExpiresAt = null;
  await user.save();
  res.json({ ok: true, email: user.email });
}));

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, businessName, fullName, nin } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new AppError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, businessName, fullName, nin });

  // A failed email must not block sign-up: the app shows a "verify your
  // email" banner and the seller can request a new code.
  await issueAndSendOtp(user).catch((err) => console.error('[auth] failed to send OTP', err));

  res.status(201).json(await issueSession(res, user));
}));

const loginSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  password: Joi.string().required(),
  returnTo: Joi.string().pattern(/^\/(?:r|escrow)\/[a-f\d]{24}(?:\/t\/[a-f\d]{24})?$/i),
});

const signIn = asyncHandler(async (req, res) => {
  const { email, password, returnTo } = req.body;

  const user = await User.findOne({ email }).select('+emailVerificationTokenHash');
  // Google-only accounts have no password hash; check before comparing.
  const valid = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    if (user && !user.passwordHash) {
      throw new AppError(401, 'This account uses Google Sign-In — log in with Google instead');
    }
    throw new AppError(401, 'Invalid email or password');
  }
  if (!user.emailVerified && user.emailVerificationTokenHash) {
    throw new AppError(403, 'Verify your email from the link we sent before signing in');
  }

  const target = applyEscrowReturn(user, returnTo);
  if (target) await user.save();
  res.json(await issueSession(res, user));
});

authRouter.post('/login', authLimiter, validate(loginSchema), signIn);
authRouter.post('/sign-in', authLimiter, validate(loginSchema), signIn);

// --- Google Sign-In ---------------------------------------------------
// The browser gets a signed ID token from Google and we verify it. The
// first sign-in with a new Google email creates the account.
authRouter.get('/google/config', (_req, res) => {
  res.json({ enabled: isGoogleSignInConfigured(), clientId: env.google.clientId });
});

const googleSchema = Joi.object({
  idToken: Joi.string().required(),
  returnTo: Joi.string().pattern(/^\/(?:r|escrow)\/[a-f\d]{24}(?:\/t\/[a-f\d]{24})?$/i),
});

authRouter.post('/google', authLimiter, validate(googleSchema), asyncHandler(async (req, res) => {
  const { googleId, email, name } = await verifyGoogleIdToken(req.body.idToken);

  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  let accountCreated = false;
  if (!user) {
    user = await User.create({
      email,
      googleId,
      fullName: name || '',
      businessName: name || email.split('@')[0],
      emailVerified: true, // Google has already verified this address
    });
    accountCreated = true;
  } else if (!user.googleId) {
    // Existing email/password account: link Google to it, no duplicate.
    user.googleId = googleId;
    user.emailVerified = true;
    await user.save();
  }

  const target = applyEscrowReturn(user, req.body.returnTo);
  if (target) await user.save();
  if (accountCreated) recordAuthFunnelEvent('registration_completed', user._id, target);
  res.json({ ...await issueSession(res, user), accountCreated });
}));

// --- Email OTP verification ------------------------------------------
async function issueAndSendOtp(user) {
  const { code, hash, expiresAt } = generateOtp();
  user.otpCodeHash = hash;
  user.otpExpiresAt = expiresAt;
  await user.save();
  await sendOtpEmail(user.email, code);
}

authRouter.post('/resend-otp', authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });

  await issueAndSendOtp(user);
  res.json({ ok: true });
}));

const verifyOtpSchema = Joi.object({ code: Joi.string().length(6).pattern(/^\d+$/).required() });

authRouter.post(
  '/verify-otp',
  authLimiter,
  requireAuth,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.sellerId).select('+otpCodeHash +otpExpiresAt');
    if (!user) throw new AppError(404, 'Seller not found');

    if (!verifyOtp(req.body.code, user.otpCodeHash, user.otpExpiresAt)) {
      throw new AppError(400, 'That code is invalid or has expired');
    }

    user.emailVerified = true;
    user.otpCodeHash = null;
    user.otpExpiresAt = null;
    await user.save();
    res.json({ ok: true, seller: user });
  })
);

// --- Forgot / reset password ------------------------------------------
const forgotPasswordSchema = Joi.object({ email: Joi.string().email().required() });

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    // Same response whether or not the account exists, so this cannot
    // be used to discover registered emails.
    if (user) {
      const { token, hash, expiresAt } = generateResetToken();
      user.resetTokenHash = hash;
      user.resetTokenExpiresAt = expiresAt;
      await user.save();
      const resetUrl = `${env.clientUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
      await sendPasswordResetEmail(user.email, resetUrl).catch((err) =>
        console.error('[auth] failed to send reset email', err)
      );
    }
    res.json({ ok: true });
  })
);

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

authRouter.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email, token, password } = req.body;
    const user = await User.findOne({ email }).select('+resetTokenHash +resetTokenExpiresAt');
    if (!user || !verifyResetToken(token, user.resetTokenHash, user.resetTokenExpiresAt)) {
      throw new AppError(400, 'This reset link is invalid or has expired');
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();
    res.json({ ok: true });
  })
);

authRouter.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError(401, 'Missing refresh token');

  try {
    const payload = jwt.verify(token, env.jwt.refreshSecret);
    const accessToken = signAccessToken(payload.sub);
    res.json({ accessToken });
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }
});

authRouter.post('/logout', (_req, res) => {
  // Must use the same cookie attributes as when it was set.
  res.clearCookie('refreshToken', refreshCookieOptions());
  res.status(204).end();
});

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  res.json({ seller: user });
}));
