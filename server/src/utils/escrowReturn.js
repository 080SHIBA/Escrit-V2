const RETURN_TO_PATTERN = /^\/(?:r|escrow)\/([a-f\d]{24})(?:\/t\/([a-f\d]{24}))?$/i;

export function parseEscrowReturnTo(value) {
  if (typeof value !== 'string') return null;
  const match = RETURN_TO_PATTERN.exec(value);
  if (!match) return null;
  return {
    linkId: match[1].toLowerCase(),
    transactionId: match[2]?.toLowerCase() || '',
  };
}

export function escrowReturnPath(target) {
  if (!target?.linkId) return '';
  return target.transactionId
    ? `/r/${target.linkId}/t/${target.transactionId}`
    : `/r/${target.linkId}`;
}
