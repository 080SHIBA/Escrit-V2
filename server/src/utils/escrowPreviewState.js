import { TX_STATUS } from '../models/Transaction.js';

export function classifyEscrowPreviewState({
  link,
  transaction,
  transactionRequested = false,
  requesterId = '',
  requesterEmail = '',
}) {
  if (!link) return 'invalid';
  if (link.expiresAt && new Date(link.expiresAt) <= new Date()) return 'expired';
  if (!link.active) return 'cancelled';
  if (!transactionRequested) return 'valid';
  if (!transaction || String(transaction.linkId) !== String(link._id)) return 'invalid';

  const ownsTransaction = transaction.buyerUserId
    ? String(transaction.buyerUserId) === String(requesterId)
    : Boolean(requesterEmail && transaction.buyerEmail)
      && String(transaction.buyerEmail).toLowerCase() === String(requesterEmail).toLowerCase();
  if (!ownsTransaction) return 'invalid';
  if (transaction.status !== TX_STATUS.CREATED || transaction.termsAcceptedAt) return 'already_accepted';
  return 'valid';
}
