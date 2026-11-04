import crypto from 'crypto';
import { User } from '../models/User.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRandomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

export async function ensureUserReferralCode(user) {
  if (user.referralCode) return user.referralCode;

  let code = '';
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    attempts++;
    const random = generateRandomCode(6);
    code = `ESC-${random}`;
    exists = await User.exists({ referralCode: code });
  }

  user.referralCode = code;
  await user.save();
  return code;
}

