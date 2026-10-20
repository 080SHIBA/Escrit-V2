import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import LifecycleStepper from '../../components/LifecycleStepper.jsx';
import ItemPhoto from '../../components/ItemPhoto.jsx';
import { CopyIcon, ClockIcon, AlertIcon } from '../../components/icons.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import SpotlightTour from '../../components/SpotlightTour.jsx';
import PhotoField from '../../components/PhotoField.jsx';
import { DEFAULT_RELEASE_WINDOW_HOURS, releaseRuleText } from '../../../../shared/releaseConditions.js';

const TOUR_STEPS = [
  {
    selector: '[data-tour="link-share-url"]',
    title: 'Your shareable link',
    body: 'Copy this link and send it to buyers. You can come back to this page any time from your dashboard.',
  },
  {
    selector: '[data-tour="link-orders"]',
    title: 'Every order, tracked',
    body: 'Each buyer gets their own order with its own status, buyer details and dispute history.',
  },
];

// A seller's home for one link: its shareable URL and every order placed
// through it. Always reachable from the dashboard.
export default function LinkDetail() {
  const { id } = useParams();
  const { seller } = useAuthContext();
  const [link, setLink] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const pollRef = useRef(null);

  usePageTitle(link?.itemName || 'Link details');

  useEffect(() => {
    let cancelled = false;
    function load(silent) {
      api
        .getLink(id)
        .then((d) => {
          if (cancelled) return;
          setLink(d.link);
          setTransactions(d.transactions);
        })
        .catch((err) => !cancelled && !silent && setError(err.message));
    }
    load(false);
    // Payment and fulfillment changes are reflected here as buyers and sellers act.
    pollRef.current = setInterval(() => load(true), 10000);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [id]);

  async function copyLink() {
    const shareUrl = `${window.location.origin}/r/${link._id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be blocked; the link stays visible to copy by hand.
    }
  }

  async function toggleActive() {
    setTogglingActive(true);
    try {
      const { link: updated } = await api.setLinkActive(link._id, !link.active);
      setLink(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingActive(false);
    }
  }

  async function updateFulfillment(txId, payload) {
    const { transaction } = await api.updateFulfillment(link._id, txId, payload);
    setTransactions((current) => current.map((tx) => (tx._id === txId ? transaction : tx)));
  }

  async function resolveNoShow(txId, outcome) {
    const { transaction } = await api.resolveProductNoShow(link._id, txId, outcome);
    setTransactions((current) => current.map((tx) => (tx._id === txId ? transaction : tx)));
  }

  async function submitEvidence(txId, payload) {
    const { transaction } = await api.submitSellerEvidence(link._id, txId, payload);
    setTransactions((current) => current.map((tx) => tx._id === txId ? transaction : tx));
  }

  if (error) return <p className="text-dispute text-sm" role="alert">{error}</p>;
  if (!link) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading link">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/r/${link._id}`;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
        <h1 className="font-display text-2xl break-words min-w-0">{link.itemName}</h1>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap ${
            link.active ? 'border-released/40 bg-released-soft text-released' : 'border-line bg-line/20 text-ink/50'
          }`}
        >
          {link.active ? 'Accepting orders' : 'Inactive'}
        </span>
      </div>

      {link.itemDescription && <p className="text-ink/60 mb-4 break-words">{link.itemDescription}</p>}

      {link.fulfillmentType !== 'service' && (
        <section className="certificate mb-4 p-4" aria-labelledby="release-condition-heading">
          <h2 id="release-condition-heading" className="text-sm font-semibold">Agreed release condition</h2>
          <p className="mt-1 text-sm leading-6 text-ink/70">
            {releaseRuleText(link.releaseWindowHours ?? DEFAULT_RELEASE_WINDOW_HOURS, link.fulfillmentType)}
          </p>
        </section>
      )}

      <ItemPhoto
        src={link.itemPhotoUrl}
        alt={link.itemName}
        className="w-full max-h-72 object-cover border border-line rounded-xl mb-4"
      />

      <div className="certificate p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm min-w-0">
          <p className="font-mono font-medium">₦{(link.priceKobo / 100).toLocaleString()}</p>
          <p className="text-ink/60 mt-0.5">
            {link.active
              ? 'This link can be shared with any number of buyers at once.'
              : 'New checkouts are off. Orders already in progress continue as normal.'}
          </p>
        </div>
        <button
          onClick={toggleActive}
          disabled={togglingActive}
          className="shrink-0 border border-line px-3 py-1.5 text-sm font-medium hover:border-ink transition-colors disabled:opacity-50 rounded-lg"
        >
          {togglingActive ? '…' : link.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>

      <div className="mb-6">
        <p className="text-sm text-ink/70 mb-1">Share this link with buyers</p>
        <div className="certificate p-3 flex items-center justify-between gap-3" data-tour="link-share-url">
          <span className="font-mono text-sm break-all">{shareUrl}</span>
          <button
            onClick={copyLink}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium border border-line px-2.5 py-1.5 hover:border-ink transition-colors rounded-lg"
          >
            <CopyIcon />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <h2 className="font-display text-lg mb-3">
        Orders {transactions?.length > 0 && <span className="text-ink/40 font-sans text-sm font-normal">({transactions.length})</span>}
      </h2>

      {transactions?.length === 0 && (
        <p className="certificate p-4 text-sm text-ink/60">
          No one has checked out yet. Once a buyer pays, their order shows up here.
        </p>
      )}

      <div className="space-y-3" data-tour="link-orders">
        {transactions?.map((tx) => (
          <TransactionRow key={tx._id} tx={tx} fulfillmentType={link.fulfillmentType || 'product'} refundable={link.refundable} onUpdate={updateFulfillment} onResolveNoShow={resolveNoShow} onAddEvidence={submitEvidence} />
        ))}
      </div>

      <SpotlightTour storageKey="escrit_seller_tour_linkdetail" userId={seller?._id} steps={TOUR_STEPS} active={Boolean(transactions)} />
    </div>
  );
}

function TransactionRow({ tx, fulfillmentType, refundable, onUpdate, onResolveNoShow, onAddEvidence }) {
  const [open, setOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState(tx.status === 'DIRECT_PAID' ? 'SERVICE_COMPLETE' : fulfillmentType === 'service' ? 'READY_FOR_MEETING' : 'IN_TRANSIT');
  const [trackingReference, setTrackingReference] = useState(tx.trackingReference || '');
  const [note, setNote] = useState(tx.fulfillmentNote || '');
  const [proofUrl, setProofUrl] = useState(tx.deliveryProofUrl || '');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  async function submitFulfillment(event) {
    event.preventDefault();
    setUpdating(true);
    setUpdateError('');
    try {
      await onUpdate(tx._id, { status: nextStatus, trackingReference, note, proofUrl });
    } catch (err) {
      setUpdateError(err.message || 'Could not update this order.');
    } finally {
      setUpdating(false);
    }
  }

  async function chooseNoShowOutcome(outcome) {
    setResolving(true);
    setUpdateError('');
    try {
      await onResolveNoShow(tx._id, outcome);
    } catch (err) {
      setUpdateError(err.message || 'Could not resolve this no-show.');
    } finally {
      setResolving(false);
    }
  }

  async function submitEvidence(event) {
    event.preventDefault();
    setUpdating(true);
    setUpdateError('');
    try {
      await onAddEvidence(tx._id, { text: evidenceText, mediaUrl: evidenceUrl });
      setEvidenceText('');
      setEvidenceUrl('');
    } catch (err) {
      setUpdateError(err.message || 'Could not submit evidence.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="certificate p-4 animate-fade-in-up">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="font-medium truncate">{tx.buyerEmail || 'Unknown buyer'}</p>
          <p className="text-xs text-ink/50">{new Date(tx.createdAt).toLocaleString()}</p>
        </div>
        <span className="shrink-0"><StatusBadge status={tx.status} /></span>
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-line space-y-3 animate-fade-in-up">
          <LifecycleStepper status={tx.status} />

          <div className="space-y-2 text-sm">
            <Row label="Buyer phone" value={tx.buyerPhone || '—'} />
            {tx.paidAt && <Row label="Paid" value={new Date(tx.paidAt).toLocaleString()} />}
            {tx.fulfillmentUpdatedAt && <Row label="Fulfillment updated" value={new Date(tx.fulfillmentUpdatedAt).toLocaleString()} />}
            {tx.releasedAt && <Row label="Released" value={new Date(tx.releasedAt).toLocaleString()} />}
          </div>

          {(tx.status === 'PAID_HELD' && !['DELIVERED', 'SERVICE_COMPLETE'].includes(tx.fulfillmentStatus) || tx.status === 'DIRECT_PAID' && fulfillmentType === 'service') && (
            <form onSubmit={submitFulfillment} className="space-y-3 rounded-lg border border-line p-3">
              <p className="text-sm font-medium">{tx.status === 'DIRECT_PAID' ? 'Complete direct service booking' : 'Update fulfillment'}</p>
              <label className="block text-sm">
                <span className="text-ink/65">Status</span>
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg">
                  {(tx.status === 'DIRECT_PAID'
                    ? [['SERVICE_COMPLETE', 'Service completed']]
                    : fulfillmentType === 'service'
                    ? [['READY_FOR_MEETING', 'Meeting arranged'], ['SERVICE_COMPLETE', 'Service completed'], ['BUYER_NO_SHOW', 'Buyer did not attend']]
                    : [['IN_TRANSIT', 'Shipped / in transit'], ['DELIVERED', 'Delivered'], ['BUYER_NO_SHOW', 'Buyer did not attend pickup']]
                  ).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {fulfillmentType !== 'service' && (
                <label className="block text-sm">
                  <span className="text-ink/65">Tracking reference</span>
                  <input value={trackingReference} onChange={(event) => setTrackingReference(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" maxLength={160} />
                </label>
              )}
              <label className="block text-sm">
                <span className="text-ink/65">Update for buyer</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" maxLength={500} />
              </label>
              <div><p className="mb-1 text-sm text-ink/65">Delivery evidence photo</p><PhotoField value={proofUrl} onChange={setProofUrl} /></div>
              {updateError && <p className="text-sm text-dispute" role="alert">{updateError}</p>}
              <button disabled={updating} className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-50">
                {updating ? 'Saving…' : nextStatus === 'DELIVERED' ? 'Confirm delivery with photo' : 'Save fulfillment update'}
              </button>
            </form>
          )}

          {tx.status === 'PAID_HELD' && tx.fulfillmentStatus === 'BUYER_NO_SHOW' && fulfillmentType === 'product' && !refundable && (
            <div className="rounded-lg border border-seal/30 p-3">
              <p className="text-sm font-medium">Resolve non-refundable pickup</p>
              <p className="mt-1 text-xs text-ink/60">Choose full payout or 90% of the item price as promotion credits.</p>
              {updateError && <p className="mt-2 text-sm text-dispute" role="alert">{updateError}</p>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={resolving} onClick={() => chooseNoShowOutcome('release')} className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-50">Receive item price</button>
                <button type="button" disabled={resolving} onClick={() => chooseNoShowOutcome('credit')} className="rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-50">Convert to promo credits</button>
              </div>
            </div>
          )}

          {(tx.status === 'DISPUTED' || tx.disputeReason) && (
            <div className="p-3 rounded-lg border border-dispute/40 bg-dispute-soft">
              <p className="flex items-center gap-1.5 text-dispute font-medium text-sm mb-1">
                <AlertIcon width={15} height={15} className="shrink-0" /> Buyer raised a dispute
              </p>
              <p className="text-sm text-ink/80 break-words">{tx.disputeReason}</p>
              {tx.evidence?.length > 0 && <ul className="mt-3 space-y-2 border-t border-dispute/20 pt-3">{tx.evidence.map((entry) => <li key={entry._id} className="text-xs text-ink/70"><p><strong>{entry.party === 'seller' ? 'Seller' : 'Buyer'} evidence:</strong> {entry.text || 'Media attached'}</p>{entry.mediaUrl && <a href={entry.mediaUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline underline-offset-2">Open attachment</a>}</li>)}</ul>}
              {tx.status === 'DISPUTED' && <form onSubmit={submitEvidence} className="mt-3 space-y-2 border-t border-dispute/20 pt-3"><label className="block text-xs text-ink/65">Add evidence<textarea value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} rows={2} maxLength={2000} className="mt-1 w-full border border-line bg-input px-2 py-1.5" /></label><PhotoField value={evidenceUrl} onChange={setEvidenceUrl} />{updateError && <p role="alert" className="text-xs text-dispute">{updateError}</p>}<button disabled={updating || (!evidenceText.trim() && !evidenceUrl)} className="rounded-md border border-line px-3 py-2 text-xs font-medium disabled:opacity-50">Submit evidence</button></form>}
              {tx.disputeRaisedAt && (
                <p className="text-xs text-ink/50 mt-1">{new Date(tx.disputeRaisedAt).toLocaleString()}</p>
              )}
              {tx.status === 'DISPUTED' && (
                <p className="text-xs text-ink/50 mt-2">
                  Escrit&#39;s dispute team is reviewing this. The release is frozen and the payment stays held
                  until it is resolved.
                </p>
              )}
              {(tx.status === 'RESOLVED_RELEASED' || tx.status === 'RESOLVED_REFUNDED' || tx.status === 'RESOLVED_CREDITED') && (
                <div className="mt-2 pt-2 border-t border-dispute/30 space-y-1">
                  <p className="text-xs font-medium text-ink/70">
                    Resolved: {tx.status === 'RESOLVED_REFUNDED' ? 'refunded to buyer' : tx.status === 'RESOLVED_CREDITED' ? 'promotion credits issued' : 'released to you'}
                  </p>
                  {tx.resolutionNote && (
                    <p className="text-xs text-ink/60 break-words">{tx.resolutionNote}</p>
                  )}
                  {tx.resolvedAt && (
                    <p className="text-xs text-ink/45">{new Date(tx.resolvedAt).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {tx.payoutLog?.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Payout activity</p>
              <ul className="space-y-2 text-sm">
                {tx.payoutLog.map((entry, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 text-ink/70">
                    <span className="capitalize">{entry.action.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-ink/45 whitespace-nowrap">
                      {new Date(entry.at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink/60 shrink-0">{label}</span>
      <span className="font-medium font-mono text-right break-words min-w-0">{value}</span>
    </div>
  );
}
