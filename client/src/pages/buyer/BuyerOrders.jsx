/* Hallmark · macrostructure: Narrative Workflow · tone: utilitarian · anchor hue: cyan · theme: Midnight · nav/footer: existing app shell */
/* Hallmark · pre-emit critique: P4 H5 E4 S5 R4 V4 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HandshakeIcon, MyOrdersIcon } from '../../components/icons.jsx';
import { api } from '../../lib/api.js';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { useOrders, useOrderActions } from '../../lib/useOrders.js';
import {
  ORDER_FILTERS,
  ORDER_STAGES,
  countOrdersByFilter,
  deliveryReleaseTime,
  filterOrders,
  orderFilter,
} from '../../shared/orderState.js';

const currency = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

function statusStyle(order) {
  if (order.disputed) return 'border-dispute/40 bg-dispute-soft text-dispute';
  if (order.finalOutcome === 'refunded') return 'border-line-strong bg-paper-3 text-ink/70';
  if (order.finalOutcome === 'credited') return 'border-ochre/35 bg-ochre/10 text-ochre';
  if (order.stage === 0) return 'border-ochre/35 bg-ochre/10 text-ochre';
  if (order.stage === 3) return 'border-released/35 bg-released-soft text-released';
  return 'border-accent/35 bg-accent/10 text-accent';
}

function friendlyError(error) {
  const message = error?.message || '';
  return /request failed|internal server|(^|\D)5\d\d(\D|$)/i.test(message)
    ? 'We couldn’t update this order. Please try again.'
    : message || 'We couldn’t update this order. Please try again.';
}

export function RoleTabs({ role, onChange }) {
  return (
    <div role="group" aria-label="Order type" className="inline-flex rounded-xl border border-line bg-paper-2 p-1">
      {['sell', 'buy'].map((entry) => (
        <button
          key={entry}
          type="button"
          aria-pressed={role === entry}
          onClick={() => onChange(entry)}
          className={`min-h-11 rounded-lg px-5 text-sm font-medium transition-colors motion-reduce:transition-none active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${role === entry ? 'bg-accent text-accent-ink' : 'text-ink/65 hover:text-ink'}`}
        >
          {entry === 'sell' ? 'Selling' : 'Buying'}
        </button>
      ))}
    </div>
  );
}

export function StatusChips({ orders, filter, onChange }) {
  const counts = countOrdersByFilter(orders);
  return (
    <div role="group" aria-label="Filter orders by status" className="flex flex-wrap gap-2">
      {ORDER_FILTERS.map((entry) => (
        <button
          key={entry}
          type="button"
          aria-pressed={filter === entry}
          onClick={() => onChange(entry)}
          className={`min-h-11 rounded-full border px-3 text-sm motion-reduce:transition-none active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${filter === entry ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-paper-2 text-ink/70 hover:border-line-strong hover:text-ink'}`}
        >
          {entry} <span aria-label={`${counts[entry]} orders`}>{counts[entry]}</span>
        </button>
      ))}
    </div>
  );
}

export function OrderTracker({ order }) {
  const current = Math.max(0, Math.min(3, order.stage));
  return (
    <ol aria-label="Order progress" className="grid grid-cols-4 gap-1">
      {ORDER_STAGES.map((stage, index) => {
        const complete = index < current;
        const active = index === current;
        const disputedNow = order.disputed && active;
        return (
          <li key={stage} className="min-w-0 text-center">
            <div className="flex items-center">
              <span className={`h-2 w-2 shrink-0 rounded-full ${disputedNow ? 'bg-dispute' : complete || active ? 'bg-accent' : 'bg-line-strong'}`} />
              {index < ORDER_STAGES.length - 1 && (
                <span aria-hidden="true" className={`h-px flex-1 ${index < current ? 'bg-accent' : 'bg-line'}`} />
              )}
            </div>
            <span className={`mt-2 block break-words text-[10px] leading-4 sm:text-xs ${disputedNow ? 'font-semibold text-dispute' : complete || active ? 'text-ink/85' : 'text-ink/45'}`}>
              {stage}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CountdownTimer({ dueAt }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(dueAt).getTime() - Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, new Date(dueAt).getTime() - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, [dueAt]);
  const seconds = Math.floor(remaining / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return <span aria-live="off" className="font-mono tabular-nums">{hours}h {String(minutes).padStart(2, '0')}m</span>;
}

function DisputeDialog({ onClose, onSubmit, busy, error }) {
  const [reason, setReason] = useState('');
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dispute-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-paper p-5 text-ink shadow-card-lg backdrop:bg-black/60"
    >
        <h2 id="dispute-title" className="font-display text-xl">Raise a dispute</h2>
        <p className="mt-2 text-sm text-ink/65">Tell us what went wrong. Escrit will hold the funds while the issue is reviewed.</p>
        <label htmlFor="dispute-reason" className="mt-4 block text-sm font-medium">Reason</label>
        <textarea
          id="dispute-reason"
          autoFocus
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-xl border border-line bg-input p-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          aria-describedby="dispute-help"
        />
        <p id="dispute-help" className="mt-1 text-xs text-ink/50">Use at least 5 characters. Maximum 500.</p>
        {error && <p role="alert" className="mt-2 text-sm text-dispute">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border border-line px-4 text-sm active:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Cancel</button>
          <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => onSubmit(reason.trim())} className="min-h-11 rounded-xl border border-dispute px-4 text-sm font-semibold text-dispute active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
            {busy ? 'Sending…' : 'Submit dispute'}
          </button>
        </div>
    </dialog>
  );
}

export function OrderActions({ order, role, onAction, busy, onDispute }) {
  if (order.disputed) {
    return (
      <div>
        <p className="text-sm font-medium text-dispute">Funds are frozen until the dispute is resolved.</p>
        <Link to="/account/offers" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold active:bg-paper-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"><HandshakeIcon width={16} height={16} />Open chat</Link>
      </div>
    );
  }
  if (role === 'sell' && order.stage === 0) {
    return (
      <div>
        <p className="text-sm text-ink/70">Waiting for the buyer to pay.</p>
        <div className="mt-3"><CopyPaymentLink order={order} /></div>
      </div>
    );
  }
  if (role === 'sell' && order.stage === 1) {
    return (
      <div>
        <p className="text-sm text-ink/70">Buyer has paid and the money is safe in escrow. Deliver, then mark it.</p>
        <button type="button" disabled={busy} onClick={() => onAction('deliver')} className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{busy ? 'Updating…' : 'Mark as delivered'}</button>
      </div>
    );
  }
  if (role === 'sell' && order.stage === 2) {
    return (
      <p className="text-sm text-ink/70">
        {order.payoutState === 'failed'
          ? 'The automatic payout could not complete. Escrit is retrying; funds remain held.'
          : order.payoutState === 'processing'
            ? 'The payout is processing. The funds remain protected until it completes.'
            : order.releaseDueAt ? <>Releases automatically in <CountdownTimer dueAt={order.releaseDueAt} /> unless the buyer confirms sooner or disputes.</> : 'Waiting for buyer confirmation.'}
      </p>
    );
  }
  if (order.stage === 3 && order.finalOutcome === 'refunded') {
    return <p className="text-sm text-ink/70">This payment was refunded after review.</p>;
  }
  if (order.stage === 3 && order.finalOutcome === 'credited') {
    return <p className="text-sm text-ink/70">{role === 'sell' ? 'This order was resolved with promotion credits.' : 'This order was resolved after review.'}</p>;
  }
  if (role === 'sell' && order.stage === 3) {
    return <p className="text-sm text-ink/70">{currency.format(order.amount)} was paid out to your bank account.</p>;
  }
  if (role === 'buy' && order.stage === 0) return <p className="text-sm text-ink/70">Waiting for your payment to be confirmed.</p>;
  if (role === 'buy' && order.stage === 1) return <p className="text-sm text-ink/70">Your payment is held in escrow until the seller delivers.</p>;
  if (role === 'buy' && order.stage === 2) {
    return (
      <div>
        <p className="text-sm text-ink/70">Happy with it? Confirm to release payment, or raise a dispute.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => onAction('confirm')} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{busy ? 'Updating…' : 'Confirm receipt'}</button>
          <button type="button" disabled={busy} onClick={onDispute} className="min-h-11 rounded-xl border border-dispute px-4 text-sm font-semibold text-dispute active:bg-dispute-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Raise dispute</button>
        </div>
      </div>
    );
  }
  return <p className="text-sm text-ink/70">Completed. Payment released to the seller.</p>;
}

function CopyPaymentLink({ order }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${order.linkId}`);
      setCopied(true);
      setError('');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Clipboard access is unavailable. Copy the link from your listing instead.');
    }
  }
  return (
    <div>
      <button type="button" onClick={copy} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">{copied ? 'Link copied' : 'Copy payment link'}</button>
      {error && <p role="alert" className="mt-2 text-sm text-dispute">{error}</p>}
    </div>
  );
}

export function OrderCard({ order, role, expanded, onToggle, onAction, busy, error, onDispute, onRetry, retryable }) {
  return (
    <article className="rounded-2xl border border-line bg-paper-2 p-4 shadow-card sm:p-5">
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-lg text-left active:bg-paper-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:gap-4">
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-paper font-display text-lg text-accent">{order.title?.trim()?.[0]?.toUpperCase() || 'O'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{order.title}</span>
        <span className="mt-1 block truncate text-xs text-ink/55">{order.id.toUpperCase()}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold">{currency.format(order.amount)}</span>
          <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold sm:text-xs ${statusStyle(order)}`}>{order.disputed ? 'Disputed' : order.finalOutcome || orderFilter(order)}</span>
        </span>
      </button>
      {role === 'buy' && order.storefrontId && <Link to={`/marketplace/seller/${order.storefrontId}`} className="mt-2 inline-block text-xs text-ink/60 hover:text-accent hover:underline">Seller: {order.counterparty}</Link>}
      <div className="mt-5"><OrderTracker order={order} /></div>
      {expanded && (
        <section className="mt-5 border-t border-line pt-4" aria-label={`Actions for ${order.title}`}>
          <OrderActions order={order} role={role} onAction={onAction} busy={busy} onDispute={onDispute} />
          {error && (
            <div className="mt-3">
              <p role="alert" className="text-sm text-dispute">{error}</p>
              {retryable && <button type="button" disabled={busy} onClick={onRetry} className="mt-2 min-h-11 rounded-xl border border-line px-4 text-sm font-semibold active:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Retry</button>}
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function OrderSkeletons() {
  return <div aria-busy="true" aria-label="Loading orders" className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse motion-reduce:animate-none rounded-2xl border border-line bg-paper-2" />)}</div>;
}

export function OrdersPage() {
  usePageTitle('My orders');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') === 'buy' ? 'buy' : 'sell';
  const { orders, setOrders, error: loadError, retry } = useOrders(role);
  const { perform } = useOrderActions();
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionErrors, setActionErrors] = useState({});
  const [failedActions, setFailedActions] = useState({});
  const [toast, setToast] = useState('');
  const [disputeId, setDisputeId] = useState(null);
  const [disputeError, setDisputeError] = useState('');
  const [shareLinkId, setShareLinkId] = useState('');
  const [copyError, setCopyError] = useState('');
  const [listingCopied, setListingCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setShareLinkId('');
    if (role === 'sell' && orders?.length === 0) {
      api.listLinks()
        .then(({ links }) => {
          const firstLink = links?.find((entry) => entry.link?.active)?.link || links?.[0]?.link;
          if (active && firstLink) setShareLinkId(String(firstLink._id));
        })
        .catch(() => {
          if (active) setCopyError('Your listing link is temporarily unavailable.');
        });
    }
    return () => { active = false; };
  }, [role, orders]);

  useEffect(() => {
    setFilter('All');
    setExpandedId(null);
    setActionErrors({});
    setDisputeId(null);
  }, [role]);

  const visibleOrders = useMemo(() => orders ? filterOrders(orders, filter) : [], [orders, filter]);

  async function copyListingLink() {
    if (!shareLinkId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${shareLinkId}`);
      setListingCopied(true);
      setCopyError('');
      window.setTimeout(() => setListingCopied(false), 2500);
    } catch {
      setCopyError('Clipboard access is unavailable. Open your listing to copy its link.');
    }
  }

  async function runAction(order, action, payload = {}) {
    const before = order;
    setBusyId(order.id);
    setActionErrors((current) => ({ ...current, [order.id]: '' }));
    setFailedActions((current) => ({ ...current, [order.id]: action }));
    setOrders((current) => current?.map((entry) => entry.id === order.id
      ? { ...entry, ...(action === 'deliver' ? { stage: 2, deliveredAt: new Date().toISOString(), releaseDueAt: deliveryReleaseTime(new Date()).toISOString() } : action === 'confirm' ? { stage: 3 } : { disputed: true, disputeReason: payload.reason }) }
      : entry));
    try {
      const updated = await perform(order, action, role, payload);
      setOrders((current) => current?.map((entry) => entry.id === order.id ? { ...entry, ...updated } : entry));
      setToast(action === 'deliver' ? 'Delivery marked. The 72-hour release window has started.' : action === 'confirm' ? 'Receipt confirmed. Payment has been released.' : 'Dispute submitted. Funds are frozen.');
      setFailedActions((current) => ({ ...current, [order.id]: null }));
      window.setTimeout(() => setToast(''), 3500);
      setDisputeId(null);
      setDisputeError('');
    } catch (cause) {
      setOrders((current) => current?.map((entry) => entry.id === order.id ? before : entry));
      const message = friendlyError(cause);
      setActionErrors((current) => ({ ...current, [order.id]: message }));
      if (action === 'dispute') setDisputeError(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl">
      <header className="border-b border-line pb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Your account</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl">
          <MyOrdersIcon width={25} height={25} className="text-ink/60" />
          My orders
        </h1>
        <p className="mt-2 text-sm text-ink/60">Track every order from payment to payout.</p>
      </header>
      <div className="mt-5">
        <RoleTabs role={role} onChange={(next) => navigate(`/account/orders?role=${next}`)} />
      </div>
      {loadError ? (
        <div className="mt-6 rounded-2xl border border-dispute/40 bg-dispute-soft p-5">
          <p role="alert" className="text-sm text-dispute">{loadError}</p>
          <button type="button" onClick={retry} className="mt-3 min-h-11 rounded-xl border border-dispute px-4 text-sm font-semibold text-dispute active:bg-dispute-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Retry</button>
        </div>
      ) : orders === null ? <div className="mt-6"><OrderSkeletons /></div> : (
        <>
          {orders.length > 0 && <div className="mt-5"><StatusChips orders={orders} filter={filter} onChange={(next) => { setFilter(next); setExpandedId(null); }} /></div>}
          {orders.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-line bg-paper-2 px-5 py-12 text-center">
              <h2 className="font-display text-xl">No orders yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">Share a listing to get your first one.</p>
              {role === 'sell' && shareLinkId ? (
                <button type="button" onClick={copyListingLink} className="mt-5 min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                  {listingCopied ? 'Link copied' : 'Copy listing link'}
                </button>
              ) : (
                <Link to={role === 'sell' ? '/dashboard/new' : '/marketplace'} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                  {role === 'sell' ? 'Create a listing' : 'Browse marketplace'}
                </Link>
              )}
              {copyError && <p role="alert" className="mt-3 text-sm text-dispute">{copyError}</p>}
            </div>
          ) : visibleOrders.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-line bg-paper-2 p-8 text-center text-sm text-ink/60">No orders here.</p>
          ) : (
            <ul aria-label={`${role === 'sell' ? 'Selling' : 'Buying'} orders`} className="mt-5 space-y-3">
              {visibleOrders.map((order) => (
                <li key={order.id}>
                  <OrderCard
                    order={order}
                    role={role}
                    expanded={expandedId === order.id}
                    onToggle={() => setExpandedId((current) => current === order.id ? null : order.id)}
                    onAction={(action) => runAction(order, action)}
                    onDispute={() => { setDisputeId(order.id); setDisputeError(''); }}
                    onRetry={() => runAction(order, failedActions[order.id] || (role === 'sell' ? 'deliver' : 'confirm'))}
                    retryable={failedActions[order.id] !== 'dispute'}
                    busy={busyId === order.id}
                    error={actionErrors[order.id]}
                  />
                  {disputeId === order.id && (
                    <DisputeDialog
                      onClose={() => setDisputeId(null)}
                      onSubmit={(reason) => runAction(order, 'dispute', { reason })}
                      busy={busyId === order.id}
                      error={disputeError}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-accent/40 bg-paper-2 px-4 py-3 text-sm text-ink shadow-card-md">
          {toast}
        </div>
      )}
    </main>
  );
}

export default OrdersPage;
