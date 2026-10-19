const ESCROW_RETURN_TO = /^\/(?:r|escrow)\/([a-f\d]{24})(?:\/t\/([a-f\d]{24}))?$/i;

export function getEscrowReturnTo(searchParams) {
  const value = searchParams.get('returnTo') || searchParams.get('next') || '';
  return ESCROW_RETURN_TO.test(value) ? value.replace(/^\/escrow\//, '/r/') : '';
}

export function escrowOnboardingDestination(result) {
  const hasEscrowReturn = Boolean(
    result?.returnTo || result?.seller?.pendingEscrowReturn?.linkId,
  );
  return hasEscrowReturn || result?.accountCreated
    ? '/onboarding'
    : '/marketplace';
}

export function escrowTransactionPath(target) {
  if (!target?.linkId) return '';
  const path = `/escrow/${encodeURIComponent(target.linkId)}`;
  return target.transactionId
    ? `${path}?transactionId=${encodeURIComponent(target.transactionId)}`
    : path;
}
