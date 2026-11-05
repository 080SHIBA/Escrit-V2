// WHAT: generators and helpers for the codes attached to every order.
// WHY crypto.randomInt instead of Math.random: these codes identify real orders and gate delivery
// signing, so they must be unpredictable, not merely different.
import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Letters and digits that cannot be confused when read aloud or off a screen (no I, L, O, 0, 1).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomFrom(alphabet, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

export function generateTrackingCode() {
  return `ESC-${randomFrom(ALPHABET, 4)}-${randomFrom(ALPHABET, 4)}`;
}

// 8 digits, never starting with 0 so it survives being typed into a number field.
export function generateDeliveryCode() {
  return String(crypto.randomInt(10_000_000, 100_000_000));
}

function receiptKey() {
  return crypto.createHmac('sha256', env.jwt.accessSecret).update('escrit-receipt-v1').digest();
}

// WHAT: the secret part of the buyer's receipt link: "<orderId>-<signature>".
// WHY derived, not stored: the link can be re-shown to the buyer at any time (order page, email)
// without keeping a secret in the database, and it cannot be forged without the server key.
export function receiptToken(transactionId) {
  const id = String(transactionId);
  const mac = crypto.createHmac('sha256', receiptKey()).update(`receipt:${id}`).digest('hex').slice(0, 32);
  return `${id}-${mac}`;
}

// Returns the order id for a valid token, or null. Constant-time compare so timing leaks nothing.
export function parseReceiptToken(token) {
  const match = /^([\da-f]{24})-([\da-f]{32})$/i.exec(String(token || ''));
  if (!match) return null;
  const expected = Buffer.from(receiptToken(match[1]).split('-')[1]);
  const given = Buffer.from(match[2].toLowerCase());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? match[1] : null;
}

export function receiptUrl(transactionId) {
  return `${env.clientUrl}/receipt/${receiptToken(transactionId)}`;
}

// WHAT: compare phone numbers written differently (+234 801..., 0801..., 234801...).
// WHY last 10 digits: Nigerian mobile numbers are 10 digits after the leading 0 / country code.
export function samePhone(a, b) {
  const digits = (value) => String(value || '').replace(/\D/g, '').slice(-10);
  return digits(a).length === 10 && digits(a) === digits(b);
}
