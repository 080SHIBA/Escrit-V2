// WHAT: the single rule for "is this buyer allowed to check out yet?".
//
// WHY it exists: four different checkout routes each had their own copy of the
// check `!buyer.fullName || !buyer.nin`. That was wrong for approved users:
//   - KYC stores the legal name and ID number in the KycSubmission collection,
//     not on the User record, so an admin approving KYC never filled `nin`.
//   - Accounts created through Google or the newer sign-up form never have a
//     `nin` at all.
// So a buyer could be fully verified by an admin and still be told to "complete
// your identity details". One shared rule fixes all four routes at once and
// stops them drifting apart again.
import { KycSubmission } from '../models/KycSubmission.js';

export const IDENTITY_REQUIRED_MESSAGE = 'Verify your identity in Profile settings before checkout.';

// WHAT: true when the buyer has finished identity verification.
// WHY kycStatus first: an admin-approved status is the strongest proof we hold,
// so it wins over everything else and is a cheap field read (no extra query).
// WHY the legacy fallback: accounts made before KYC existed have fullName + nin
// on the User record. Keeping them working avoids locking out existing buyers.
export function buyerIdentityReady(user) {
  if (!user) return false;
  if (user.kycStatus === 'verified') return true;
  return Boolean(user.fullName && user.nin);
}

// WHAT: throws-free helper used by routes: returns an error message or ''.
// WHY a message instead of throwing: routes already build their own AppError,
// and this keeps the helper free of HTTP concerns.
export function identityBlockReason(user) {
  return buyerIdentityReady(user) ? '' : IDENTITY_REQUIRED_MESSAGE;
}

// WHAT: copies the verified legal name and ID number onto the User record.
// WHY: other code (receipts, seller payouts, support tools) still reads
// User.fullName / User.nin. Doing it once, at the moment of approval, keeps
// those readers correct without each of them having to query KycSubmission.
// WHY only fill blanks for fullName: a user may have chosen a display name; we
// must not overwrite it, but we must supply one if it is missing.
export async function syncVerifiedIdentity(user) {
  const submission = await KycSubmission.findOne({ userId: user._id }).select('+idNumber legalName idType');
  if (!submission) return;
  if (!user.fullName) user.fullName = submission.legalName;
  if (submission.idType === 'nin' && submission.idNumber) user.nin = submission.idNumber;
  await user.save();
}
