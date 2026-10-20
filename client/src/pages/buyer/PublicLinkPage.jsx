import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import LifecycleStepper from '../../components/LifecycleStepper.jsx';
import DisputePolicyNote from '../../components/DisputePolicyNote.jsx';
import SpotlightTour from '../../components/SpotlightTour.jsx';
import ItemPhoto from '../../components/ItemPhoto.jsx';
import PhotoField from '../../components/PhotoField.jsx';
import { LockIcon, ShieldCheckIcon, ClockIcon } from '../../components/icons.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import GoogleSignInButton from '../../components/GoogleSignInButton.jsx';
import { DEFAULT_RELEASE_WINDOW_HOURS, releaseRuleText } from '../../../../shared/releaseConditions.js';

const TOUR_STEPS = [
  {
    selector: '[data-tour="trust-strip"]',
    title: 'Choose escrow when it is offered',
    body: 'Escrow orders hold payment; direct payments are sent to the seller and cannot be held or recovered by Escrit.',
  },
  {
    selector: '[data-tour="verified-name"]',
    title: 'The seller is bank-verified',
    body: 'This name was confirmed with their bank before you saw this page, so a fake account cannot collect your money.',
  },
  {
    selector: '[data-tour="pay-action"]',
    title: 'What happens after you pay',
    body: 'Review the seller’s release condition before paying. You can confirm early or raise a dispute to keep your money on hold.',
  },
];

// A link is shared by many buyers, so it has no status of its own.
// Starting checkout creates an order (transaction) for this buyer, and
// this page then follows that order. Keep the order id in localStorage so a
// redirect back from the selected provider can reopen this buyer's order.
function lastOrderKey(linkId) {
  return `escrit_last_order:${linkId}`;
}

export default function PublicLinkPage() {
  const { linkId: routeLinkId, txId: routeTxId, id: escrowLinkId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const linkId = routeLinkId || escrowLinkId;
  const txId = routeTxId || searchParams.get('transactionId') || undefined;
  const { status: authStatus, login } = useAuthContext();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [kycRequired, setKycRequired] = useState(false);
  const [googleCreated, setGoogleCreated] = useState(false);
  const [noShowReason, setNoShowReason] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [reportingProblem, setReportingProblem] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState('escrow');
  const pollRef = useRef(null);
  const previewTrackedRef = useRef(false);

  usePageTitle(data?.link?.itemName || 'Pay securely', { suffix: !data?.link?.itemName });

  // On the bare product page, jump to this buyer's saved order if there is one.
  useEffect(() => {
    if (txId) return;
    const savedTxId = localStorage.getItem(lastOrderKey(linkId));
    if (savedTxId && location.pathname.startsWith('/r/')) navigate(`/r/${linkId}/t/${savedTxId}`, { replace: true });
  }, [linkId, txId, location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;
    function load(silent) {
      const fetcher = txId ? api.getPublicTransaction(linkId, txId) : api.getPublicLink(linkId);
      fetcher
        .then((d) => {
          if (cancelled) return;
          setData(d);
          if (d.link.paymentOptions && !d.link.paymentOptions.escrow && d.link.paymentOptions.direct) {
            setCheckoutMode('direct');
          }
          if (!previewTrackedRef.current) {
            previewTrackedRef.current = true;
            api.trackFunnelEvent('link_preview_viewed', linkId, txId || '')
              .catch((cause) => console.error('[funnel] could not record link_preview_viewed', cause));
          }
        })
        .catch((err) => !cancelled && !silent && setError(err.message));
    }
    load(false);
    pollRef.current = setInterval(() => load(true), 8000);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [linkId, txId]);

  async function pay(e) {
    e.preventDefault();
    if (!termsAccepted) {
      setActionError('Review and accept the transaction terms and release condition before continuing.');
      return;
    }
    if (authStatus !== 'authed') {
      const next = encodeURIComponent(txId
        ? `/r/${linkId}/t/${txId}`
        : `/r/${linkId}`);
      navigate(`/login?next=${next}`);
      return;
    }
    setActionError(null);
    setPaying(true);
    try {
      const { authorizationUrl, transactionId } = await api.checkout(linkId, { termsAccepted, checkoutMode: selectedCheckoutMode });
      localStorage.setItem(lastOrderKey(linkId), transactionId);
      window.location.href = authorizationUrl; // selected provider's hosted checkout
    } catch (err) {
      setActionError(err.message);
      setKycRequired(err.message.toLowerCase().includes('identity details'));
      setPaying(false);
    }
  }

  const signInWithGoogle = useCallback(async (idToken) => {
    setActionError(null);
    try {
      const { accessToken, accountCreated, returnTo, seller: sessionSeller } = await api.googleLogin(idToken, `/r/${linkId}${txId ? `/t/${txId}` : ''}`);
        await login(accessToken, sessionSeller || null);
      setGoogleCreated(accountCreated);
        if (returnTo || sessionSeller?.pendingEscrowReturn) {
          navigate('/onboarding', { replace: true });
        }
    } catch (err) {
      setActionError(err.message || 'Google sign-in could not be completed.');
    }
  }, [login]);

  async function confirmReceipt() {
    setActionError(null);
    setConfirming(true);
    try {
      const { transaction } = await api.confirmReceipt(linkId, txId);
      setData((d) => ({ ...d, transaction: { ...d.transaction, status: transaction.status } }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  async function submitDispute(e) {
    e.preventDefault();
    if (disputeReason.trim().length < 5) {
      setActionError('Please describe the problem in at least 5 characters.');
      return;
    }
    setActionError(null);
    setDisputing(true);
    try {
      const { transaction } = await api.raiseDispute(linkId, txId, {
        reason: disputeReason.trim(),
        evidenceText,
        evidenceUrl,
      });
      setData((d) => ({ ...d, transaction }));
      setDisputeOpen(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDisputing(false);
    }
  }

  async function reportDirectProblem(e) {
    e.preventDefault();
    if (disputeReason.trim().length < 5) {
      setActionError('Please describe the problem in at least 5 characters.');
      return;
    }
    setActionError(null);
    setReportingProblem(true);
    try {
      const { transaction } = await api.reportDirectProblem(linkId, txId, { reason: disputeReason.trim() });
      setData((d) => ({ ...d, transaction }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setReportingProblem(false);
    }
  }

  async function addMoreEvidence(event) {
    event.preventDefault();
    setActionError(null);
    setDisputing(true);
    try {
      const { transaction } = await api.submitBuyerEvidence(linkId, txId, { text: evidenceText, mediaUrl: evidenceUrl });
      setData((current) => ({ ...current, transaction }));
      setEvidenceText('');
      setEvidenceUrl('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDisputing(false);
    }
  }

  async function submitNoShowReason(event) {
    event.preventDefault();
    setActionError(null);
    setDisputing(true);
    try {
      const { transaction: updated } = await api.reportServiceNoShow(linkId, txId, { reason: noShowReason.trim() });
      setData((current) => ({ ...current, transaction: updated }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDisputing(false);
    }
  }

  if (error) return <p className="text-dispute text-sm" role="alert">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading payment link">
        <div className="skeleton h-64 w-full" />
        <div className="skeleton h-12 w-full" />
      </div>
    );
  }

  const { link, seller, transaction } = data;
  const status = transaction?.status; // undefined until checkout starts
  const termsSnapshot = transaction?.termsSnapshot || link.termsSnapshot || link.itemDescription || '';
  const paymentOptions = link.paymentOptions || (link.fulfillmentType === 'service'
    ? { escrow: false, direct: true }
    : { escrow: true, direct: false });
  const selectedCheckoutMode = transaction?.checkoutMode
    || (checkoutMode === 'direct' && !paymentOptions.direct
      ? 'escrow'
      : checkoutMode === 'escrow' && !paymentOptions.escrow
        ? 'direct'
        : checkoutMode);
  const escrowCheckout = selectedCheckoutMode === 'escrow';
  const releaseWindowHours = transaction?.releaseWindowHours ?? link.releaseWindowHours ?? DEFAULT_RELEASE_WINDOW_HOURS;

  return (
    <div className="animate-fade-in-up">
      <div
        data-tour="trust-strip"
        className="flex items-center justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs text-ink/60 mb-5 flex-wrap"
      >
        <span className="flex items-center gap-1.5">
          <LockIcon width={14} height={14} /> {escrowCheckout ? 'Funds held, not sent directly' : 'Direct service payment'}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheckIcon width={14} height={14} /> Seller details available
        </span>
        <span className="flex items-center gap-1.5">
          <ClockIcon width={14} height={14} /> {escrowCheckout ? 'Funds release after confirmation or the review period' : 'Payment is sent after the charge is confirmed'}
        </span>
      </div>

      <div className="certificate p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-2xl break-words">{link.itemName}</h1>
            {link.itemDescription && <p className="text-ink/70 mt-1 break-words">{link.itemDescription}</p>}
          </div>
          {status && <StatusBadge status={status} />}
        </div>

        <ItemPhoto
          src={link.itemPhotoUrl}
          alt={link.itemName}
          className="w-full max-h-72 object-cover border border-line rounded-xl mb-4"
        />

        <p className="text-3xl font-mono font-medium mb-1">{link.checkoutPriceKobo == null ? 'Price unavailable' : `₦${(link.checkoutPriceKobo / 100).toLocaleString()}`}</p>
        {termsSnapshot && (
          <div className="my-4 rounded-lg border border-line bg-paper-2 p-4">
            <h2 className="text-sm font-semibold">Transaction terms</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{termsSnapshot}</p>
          </div>
        )}
        {escrowCheckout && (
          <div className="my-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <h2 className="text-sm font-semibold">When your money is released</h2>
            <p className="mt-1 text-sm leading-6 text-ink/70">{releaseRuleText(releaseWindowHours, link.fulfillmentType)}</p>
          </div>
        )}
        {!escrowCheckout && paymentOptions.direct && (
          <p className="my-4 rounded-lg border border-line bg-paper-2 p-4 text-sm leading-6 text-ink/70">
            Without escrow, Escrit cannot hold or recover this money, but you can still report problems.
          </p>
        )}
        {link.fulfillmentType === 'product' && link.refundable && (
          <p className="mb-4 text-xs text-ink/55">Refundable pickup: if the seller records a no-show, 95% of the item price is automatically refunded and a disclosed 5% no-show fee is retained.</p>
        )}

        {status && (
          <div className="mb-4">
            <LifecycleStepper status={status} />
          </div>
        )}

        <div className="text-sm border-t border-line pt-4 min-w-0" data-tour="verified-name">
          <p className="text-ink/60">Seller details</p>
          <Link to={`/marketplace/seller/${seller.id}`} className="font-medium break-words hover:underline">{seller.businessName}</Link>
        </div>
      </div>

      {location.state?.accountCreated && (
        <p role="status" className="mb-4 rounded-lg border border-released/40 bg-released-soft px-4 py-3 text-sm text-released">
          Your Escrit account has been created. Continue with your purchase below.
        </p>
      )}
      {googleCreated && <p role="status" className="mb-4 rounded-lg border border-released/40 bg-released-soft px-4 py-3 text-sm text-released">Your Escrit account was created with Google. Continue to secure checkout below.</p>}

      <div data-tour="pay-action">
        {!status && link.active && link.checkoutPriceKobo != null && (
          authStatus === 'authed' ? (
            <form onSubmit={pay} className="space-y-3">
              {paymentOptions.escrow && paymentOptions.direct && (
                <fieldset>
                  <legend className="text-sm font-semibold">Choose a payment option</legend>
                  <div role="radiogroup" aria-label="Payment option" className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-focus">
                      <input type="radio" name="checkout-mode" value="escrow" checked={selectedCheckoutMode === 'escrow'} onChange={() => setCheckoutMode('escrow')} className="h-5 w-5 accent-ink" />
                      <span>Pay with escrow</span>
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-focus">
                      <input type="radio" name="checkout-mode" value="direct" checked={selectedCheckoutMode === 'direct'} onChange={() => setCheckoutMode('direct')} className="h-5 w-5 accent-ink" />
                      <span>Pay without escrow</span>
                    </label>
                  </div>
                </fieldset>
              )}
              {!escrowCheckout && paymentOptions.direct && (
                <p className="text-xs leading-5 text-ink/60">Escrit cannot hold or recover direct payments. You can still report problems.</p>
              )}
              <label className="flex min-h-11 items-start gap-3 text-sm text-ink/75">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-accent"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                <span>I have reviewed and agree to the transaction terms and selected payment option shown above.</span>
              </label>
              <button disabled={paying || seller.demoOnly || !termsAccepted} className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg">
                {paying ? 'Redirecting to checkout…' : selectedCheckoutMode === 'escrow' ? link.fulfillmentType === 'service' ? 'Book with escrow' : 'Buy with escrow' : link.fulfillmentType === 'service' ? 'Book without escrow' : 'Pay without escrow'}
              </button>
              {escrowCheckout && <p className="text-xs text-ink/50 text-center">For escrow orders, payment stays held until completion is confirmed or the default window ends. Disputes pause release.</p>}
              {seller.demoOnly && <p className="text-xs text-seal text-center">Demo seller listing. Real checkout is disabled.</p>}
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink/65">Sign in or create an account to save this order and continue to secure checkout.</p>
              <GoogleSignInButton onCredential={signInWithGoogle} onError={setActionError} />
              <Link to={`/login?returnTo=${encodeURIComponent(txId ? `/r/${linkId}/t/${txId}` : `/r/${linkId}`)}`} className="block min-h-11 w-full rounded-lg bg-ink px-4 py-3 text-center text-sm font-medium text-paper">Sign in to buy</Link>
              <Link
                to={`/register?intent=buyer&returnTo=${encodeURIComponent(txId ? `/r/${linkId}/t/${txId}` : `/r/${linkId}`)}`}
                onClick={() => api.trackFunnelEvent('registration_started', linkId, txId || '').catch((cause) => console.error('[funnel] could not record registration_started', cause))}
                className="block min-h-11 w-full rounded-lg border border-line px-4 py-3 text-center text-sm font-medium"
              >
                Create an account
              </Link>
            </div>
          )
        )}

        {!status && link.active && link.checkoutPriceKobo == null && <p className="certificate p-4 text-sm text-seal">Secure checkout is temporarily unavailable while the final price is refreshed.</p>}

        {!status && !link.active && (
          <p className="text-sm text-ink/70 certificate p-4">
            This link is no longer accepting new orders.
          </p>
        )}

        {status === 'CREATED' && (
          <p className="text-sm text-ink/70 certificate p-4">
            Awaiting confirmation of your payment. This updates automatically.
          </p>
        )}

        {status === 'DIRECT_PAID' && (
          <div className="space-y-4">
            <p className="certificate p-4 text-sm text-ink/70">Payment was confirmed and sent directly to the seller. Escrit cannot hold or recover this money, but you can still submit a problem report below.</p>
            {link.fulfillmentType === 'service' && <p className="text-sm text-ink/65">The seller will coordinate your requested appointment directly. You can track completion from My orders.</p>}
            {data.courseAccess && <CourseAccess course={data.courseAccess} />}
          </div>
        )}

        {status === 'DIRECT_COMPLETED' && <div className="certificate p-4 text-sm text-ink/70">The service provider marked your direct booking complete. Your payment was settled directly after checkout.</div>}
        {['DIRECT_PAID', 'DIRECT_COMPLETED'].includes(status) && (
          transaction.complaintLogged
            ? <p role="status" className="mt-3 rounded-lg border border-line p-4 text-sm text-ink/70">Your problem report has been recorded for Escrit review. The direct payment cannot be held or recovered.</p>
            : <form onSubmit={reportDirectProblem} className="mt-3 space-y-3 rounded-lg border border-line p-4">
              <label className="block text-sm">
                <span className="font-medium">Report a problem</span>
                <textarea required minLength={5} maxLength={500} rows={3} value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-input px-3 py-2" />
              </label>
              <button type="submit" disabled={reportingProblem} className="min-h-11 rounded-lg border border-line px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50">
                {reportingProblem ? 'Submitting report…' : 'Submit problem report'}
              </button>
            </form>
        )}

        {status === 'PAID_HELD' && (
          <div className="space-y-3">
            {data.courseAccess && <CourseAccess course={data.courseAccess} />}
            {transaction.fulfillmentStatus !== 'NOT_STARTED' && (
              <div className="certificate p-4 space-y-1 text-sm">
                <p className="font-medium">Fulfillment: {transaction.fulfillmentStatus.replace(/_/g, ' ').toLowerCase()}</p>
                {transaction.trackingReference && <p className="text-ink/65">Tracking: {transaction.trackingReference}</p>}
                {transaction.fulfillmentNote && <p className="text-ink/65">{transaction.fulfillmentNote}</p>}
                {transaction.deliveryProofUrl && <a className="underline underline-offset-4" href={transaction.deliveryProofUrl} target="_blank" rel="noreferrer">View delivery evidence</a>}
              </div>
            )}
            {transaction.fulfillmentStatus === 'BUYER_NO_SHOW' && link.fulfillmentType === 'service' && (
              <form onSubmit={submitNoShowReason} className="certificate space-y-3 border border-seal/30 p-4">
                <div>
                  <p className="font-medium">The seller recorded a missed service appointment</p>
                  <p className="mt-1 text-sm text-ink/65">Explain what happened to request a full refund before {transaction.noShowResponseDueAt ? new Date(transaction.noShowResponseDueAt).toLocaleString() : 'the response period ends'}.</p>
                </div>
                <label className="block text-sm">
                  <span className="text-ink/65">Your reason</span>
                  <textarea required minLength={5} maxLength={500} rows={3} value={noShowReason} onChange={(event) => setNoShowReason(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
                </label>
                <button disabled={disputing} className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">{disputing ? 'Submitting…' : 'Submit reason and request full refund'}</button>
              </form>
            )}
            {transaction.fulfillmentStatus === 'BUYER_NO_SHOW' && link.fulfillmentType === 'product' && !link.refundable && (
              <p className="certificate p-4 text-sm text-ink/70">This pickup was listed as non-refundable. The seller will choose to receive the item price or convert 90% into Escrit promotion credits.</p>
            )}
            {['DELIVERED', 'SERVICE_COMPLETE'].includes(transaction.fulfillmentStatus) ? (
              <>
                <p className="text-sm text-ink/70">Your payment remains held. Confirm when delivery or the service is complete, or raise a dispute if something is wrong.</p>
                <button
                  onClick={confirmReceipt}
                  disabled={confirming}
                  className="w-full bg-released text-paper py-3 font-medium hover:bg-released/90 transition-colors disabled:opacity-50 rounded-lg"
                >
                  {confirming ? 'Releasing payment…' : 'Confirm completion and release payment'}
                </button>
              </>
            ) : (
              <p className="text-sm text-ink/70 certificate p-4">Your payment is held. The seller will update you when delivery or the service meeting is ready. There is no payment-time auto-release.</p>
            )}
            {link.fulfillmentType === 'course' && !link.refundable ? (
              <p className="certificate p-4 text-sm text-ink/60">This course is non-refundable. Escrow dispute support is not available for this purchase.</p>
            ) : !disputeOpen ? (
              <div className="space-y-3">
                <button
                  onClick={() => setDisputeOpen(true)}
                  className="w-full border border-dispute text-dispute py-3 font-medium hover:bg-dispute hover:text-paper transition-colors rounded-lg"
                >
                  Something is wrong
                </button>
                <DisputePolicyNote />
              </div>
            ) : (
              <form onSubmit={submitDispute} className="certificate p-4 border-dispute/40 space-y-3 animate-fade-in-up">
                <label className="block">
                  <span className="text-sm text-ink/70">What is wrong with the order?</span>
                  <textarea
                    required
                    rows={3}
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-dispute/60 rounded-lg"
                    placeholder="Item never arrived, does not match the description..."
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-ink/70">Supporting details <span className="text-ink/40">(optional)</span></span>
                  <textarea rows={2} maxLength={2000} value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} className="mt-1 w-full border border-line px-3 py-2 bg-input" placeholder="Add context that helps explain your report." />
                </label>
                <div><p className="mb-1 text-sm text-ink/70">Photo evidence <span className="text-ink/40">(optional)</span></p><PhotoField value={evidenceUrl} onChange={setEvidenceUrl} /></div>
                <div className="flex flex-col xs:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setDisputeOpen(false)}
                    className="flex-1 border border-line py-2 text-sm font-medium hover:border-ink transition-colors rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={disputing}
                    className="flex-1 bg-dispute text-paper py-2 text-sm font-medium disabled:opacity-50 hover:bg-dispute/90 transition-colors rounded-lg"
                  >
                    {disputing ? 'Submitting…' : 'Submit dispute'}
                  </button>
                </div>
                <p className="text-xs text-ink/50">
                  This freezes the release immediately. Your payment stays held while it is reviewed.
                </p>
                <DisputePolicyNote compact />
              </form>
            )}
          </div>
        )}

        {status === 'DISPUTED' && (
          <div className="space-y-3">
            <div className="text-sm text-ink/70 certificate p-4 bg-dispute-soft border-dispute/40 space-y-2">
              <p>{transaction.complaintLogged ? 'Delivery was already confirmed, so the seller was paid. Your complaint is recorded for Escrit admin review.' : 'Your dispute was submitted and the release is frozen. Your payment stays held during the review.'}</p>
              {transaction.disputeReason && (
                <p className="text-xs text-ink/60 break-words">
                  <span className="font-medium text-ink/70">What you reported: </span>
                  {transaction.disputeReason}
                </p>
              )}
              {transaction.disputeRaisedAt && (
                <p className="text-xs text-ink/50">
                  Submitted {new Date(transaction.disputeRaisedAt).toLocaleString()}
                </p>
              )}
              {transaction.evidence?.length > 0 && <ul className="space-y-2 border-t border-dispute/20 pt-3">{transaction.evidence.map((entry) => <li key={entry._id} className="text-xs text-ink/70"><p><strong>{entry.party === 'buyer' ? 'Your evidence' : 'Seller evidence'}:</strong> {entry.text || 'Media attached'}</p>{entry.mediaUrl && <a href={entry.mediaUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline underline-offset-2">Open attachment</a>}</li>)}</ul>}
            </div>
            <form onSubmit={addMoreEvidence} className="certificate space-y-3 p-4"><p className="text-sm font-medium">Add evidence to your open dispute</p><textarea value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} rows={2} maxLength={2000} className="w-full border border-line bg-input px-3 py-2 text-sm" placeholder="Add details or context" /><PhotoField value={evidenceUrl} onChange={setEvidenceUrl} /><button disabled={disputing || (!evidenceText.trim() && !evidenceUrl)} className="rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-50">{disputing ? 'Submitting…' : 'Submit evidence'}</button></form>
            <DisputePolicyNote compact />
          </div>
        )}

        {(status === 'RELEASED' || status === 'RESOLVED_RELEASED' || status === 'RESOLVED_REFUNDED' || status === 'RESOLVED_CREDITED') && (
          <div className="text-sm text-ink/70 certificate p-4 space-y-2">
            <p>
              This order is closed. {status === 'RESOLVED_REFUNDED' ? 'Your payment was refunded.' : status === 'RESOLVED_CREDITED' ? 'The seller chose promotion credits.' : 'Payment has been released.'}
            </p>
            {status === 'RESOLVED_RELEASED' && transaction.complaintLogged && <p className="text-xs text-ink/60">Your report remains available to Escrit admins even though delivery confirmation released the funds.</p>}
            {(status === 'RESOLVED_RELEASED' || status === 'RESOLVED_REFUNDED' || status === 'RESOLVED_CREDITED') && !transaction.complaintLogged && (
              <>
                <p className="text-xs text-ink/60 border-t border-line pt-2">
                  This outcome was decided by Escrit&#39;s dispute team after reviewing your dispute.
                </p>
                {transaction.resolutionNote && (
                  <p className="text-xs text-ink/60 break-words">
                    <span className="font-medium text-ink/70">Reason given: </span>
                    {transaction.resolutionNote}
                  </p>
                )}
                {transaction.resolvedAt && (
                  <p className="text-xs text-ink/45">
                    Resolved {new Date(transaction.resolvedAt).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {actionError && <p className="text-dispute text-sm mt-3 animate-fade-in-up" role="alert">{actionError}</p>}
      {kycRequired && <Link to={`/settings?next=${encodeURIComponent(location.pathname)}`} className="mt-2 inline-block text-sm font-medium underline underline-offset-4">Complete identity details in Profile settings</Link>}

      <SpotlightTour storageKey="escrit_buyer_tour" steps={TOUR_STEPS} active={Boolean(data) && !status && escrowCheckout} />
    </div>
  );
}

function CourseAccess({ course }) {
  return <section className="certificate space-y-4 p-5"><div><p className="text-xs uppercase tracking-wider text-released">Course access unlocked</p><h2 className="mt-1 font-display text-xl">Your curriculum</h2></div>{course.deliveryFormat && <p className="text-sm text-ink/60">{course.deliveryFormat === 'live' ? 'Live course' : 'Self-paced course'}</p>}<ol className="space-y-3">{course.curriculum?.map((module, index) => <li key={`${module.title}-${index}`} className="border-t border-line pt-3"><h3 className="font-medium">{index + 1}. {module.title}</h3>{module.description && <p className="mt-1 text-sm leading-6 text-ink/65">{module.description}</p>}{module.videoUrl && <a href={module.videoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline underline-offset-4">Open lesson video</a>}</li>)}</ol></section>;
}
