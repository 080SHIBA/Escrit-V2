// One-time codes and reset tokens. Only a SHA-256 hash is stored, so a
// database leak does not expose working codes.
import crypto from 'crypto';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isLive(hash, expiresAt) {
  return Boolean(hash && expiresAt && expiresAt >= new Date());
}

// Six digits: easy to type on a phone, and safe because attempts are rate limited.
export function generateOtp() {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  return { code, hash: sha256(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) };
}

export function verifyOtp(code, hash, expiresAt) {
  return isLive(hash, expiresAt) && sha256(code) === hash;
}

// Long random token: it travels in a URL, so it must be unguessable.
export function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: sha256(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) };
}

export function verifyResetToken(token, hash, expiresAt) {
  return isLive(hash, expiresAt) && sha256(token) === hash;
}

export function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    hash: sha256(token),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  };
}

export function hashVerificationToken(token) {
  return sha256(token);
}

export function verifyVerificationToken(token, hash, expiresAt) {
  return isLive(hash, expiresAt) && sha256(token) === hash;
}
