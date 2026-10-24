import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { serviceOrderMocksEnabled } from '../../lib/serviceOrderMocks.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

const statusLabel = {
  pending_approval: 'Awaiting provider confirmation',
  awaiting_payment: 'Ready for payment',
  ready_to_start: 'Ready to start',
  confirmed: 'Appointment confirmed',
  in_progress: 'In progress',
  delivered: 'Delivered',
  revision_requested: 'Revision requested',
  completed: 'Completed',
  disputed: 'Under dispute',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export default function ServiceOrders() {
  const { seller } = useAuthContext();
  const myId = String(seller?._id || seller?.id || seller?.sellerId || '');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});
  const [deliverableUrls, setDeliverableUrls] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [rescheduleInputs, setRescheduleInputs] = useState({});
  const [disputeReasons, setDisputeReasons] = useState({});
  usePageTitle('Service orders');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const result = await api.getMyServiceOrders();
      setOrders(result.orders || []);
    } catch (err) {
      setError(err.message || 'Could not load service orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function run(order, action) {
    setBusyId(order._id);
    setError('');
    try {
      if (action === 'checkout') {
        const result = await api.checkoutServiceOrder(order._id);
        window.location.assign(result.authorizationUrl);
        return;
      }
      if (action === 'message') {
        const message = messageDrafts[order._id]?.trim();
        if (!message) return;
        await api.sendServiceOrderMessage(order._id, message);
        setMessageDrafts((current) => ({ ...current, [order._id]: '' }));
        await refresh();
        return;
      }
      if (action === 'dispute') {
        const reason = disputeReasons[order._id]?.trim();
        if (!reason) throw new Error('Enter a reason for the dispute.');
        await api.updateServiceOrder(order._id, action, { reason });
        await refresh();
        return;
      }
      if (action === 'reschedule-request') {
        const appointmentAt = rescheduleInputs[order._id];
        if (!appointmentAt) throw new Error('Choose a proposed appointment time.');
        await api.updateServiceOrder(order._id, action, { appointmentAt: new Date(appointmentAt).toISOString() });
        await refresh();
        return;
      }
      const payload = action === 'deliver'
        ? {
          note: notes[order._id] || '',
          deliverables: deliverableUrls[order._id]
            ? [{ url: deliverableUrls[order._id], note: notes[order._id] || '' }]
            : [],
        }
        : { note: notes[order._id] || '' };
      await api.updateServiceOrder(order._id, action, payload);
      await refresh();
    } catch (err) {
      setError(err.message || 'That service order could not be updated.');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-10" aria-busy="true">Loading service orders…</div>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Your work, in one place</p><h1 className="mt-2 font-display text-3xl">Service orders</h1></div>
        <Link to="/marketplace/services" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Browse services</Link>
      </header>
      {error && <p role="alert" className="mt-4 rounded-lg border border-dispute/30 p-3 text-sm text-dispute">{error}</p>}
      {!orders.length ? <section className="py-14 text-center"><h2 className="font-display text-2xl">No service orders yet</h2><p className="mt-2 text-sm text-ink/60">Appointments, fixed-scope work and accepted quotes will appear here.</p></section> : (
        <ul className="mt-5 space-y-4">
          {orders.map((order) => {
            const isBuyer = serviceOrderMocksEnabled || String(order.buyerId?._id || order.buyerId) === myId;
            const isSeller = String(order.sellerId?._id || order.sellerId) === myId;
            const disputed = order.status === 'disputed' || order.transactionId?.status === 'DISPUTED';
            const service = order.serviceId || {};
            return <li key={order._id} className="rounded-xl border border-line bg-paper p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{order.kind.replace('_', ' ')} · {disputed ? statusLabel.disputed : statusLabel[order.status] || order.status}</p>
                  <h2 className="mt-1 font-display text-xl">{service.title || 'Service'}</h2>
                  <p className="mt-1 text-sm text-ink/60">{isBuyer ? `Provider: ${order.sellerId?.displayName || order.sellerId?.businessName || 'Escrit seller'}` : `Buyer: ${order.buyerId?.displayName || order.buyerId?.businessName || 'Escrit buyer'}`}</p>
                </div>
                <div className="text-right"><p className="font-semibold">₦{(Number(order.amountKobo) / 100).toLocaleString('en-NG')}</p><p className="mt-1 text-xs text-ink/55">{order.paymentMode === 'escrow' ? 'Escrow selected' : 'Direct payment · no escrow'}</p></div>
              </div>
              {order.appointmentAt && <p className="mt-3 text-sm text-ink/65">Appointment: {new Date(order.appointmentAt).toLocaleString(undefined, { timeZone: order.timeZone || undefined })} ({order.timeZone})</p>}
              {order.packageSnapshot && <p className="mt-2 text-sm text-ink/65">Package: {order.packageSnapshot.name}{order.packageSnapshot.deliveryDays ? ` · ${order.packageSnapshot.deliveryDays} day delivery` : ''}</p>}
              <details className="mt-3 rounded-lg bg-surface p-3">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Terms saved with this order</summary>
                <pre className="whitespace-pre-wrap text-xs leading-5 text-ink/65">{order.termsSnapshot}</pre>
              </details>
              {order.details && <p className="mt-3 whitespace-pre-line text-sm text-ink/65">{order.details}</p>}
              {order.deliverables?.length > 0 && <ul className="mt-3 space-y-2">{order.deliverables.map((item) => <li key={item._id}><a href={item.url} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">{item.note || 'View submitted deliverable'}</a></li>)}</ul>}
              {order.status === 'completed' && service._id && <Link to={`/listing/${service._id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Review this service</Link>}
              {isBuyer && order.paymentMode === 'escrow' && order.paymentStatus === 'paid' && order.status === 'delivered' && !disputed && (
                <section className="mt-4 rounded-lg border border-dispute/30 p-3">
                  <h3 className="text-sm font-semibold">Need help with this delivery?</h3>
                  <label className="mt-2 block text-xs text-ink/60">Explain the issue
                    <textarea rows={2} maxLength={500} value={disputeReasons[order._id] || ''} onChange={(event) => setDisputeReasons((current) => ({ ...current, [order._id]: event.target.value }))} className="mt-1 w-full border border-line bg-input px-3 py-2" />
                  </label>
                  <button type="button" onClick={() => run(order, 'dispute')} disabled={Boolean(busyId) || (disputeReasons[order._id] || '').trim().length < 5} className="mt-2 min-h-11 rounded-lg border border-dispute/40 px-4 text-sm text-dispute disabled:opacity-50">Open escrow dispute</button>
                </section>
              )}
              <details className="mt-4 rounded-lg border border-line p-3">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Order conversation</summary>
                <ol aria-label="Service order messages" className="space-y-2">
                  {(order.events || []).filter((event) => ['message', 'reschedule_requested', 'rescheduled'].includes(event.status)).map((event, index) => (
                    <li key={`${event.createdAt || index}-${index}`} className="rounded-lg bg-surface p-3 text-sm">
                      <p className="text-[11px] text-ink/45">{String(event.actorId?._id || event.actorId) === myId ? 'You' : 'Other party'} · {event.status === 'message' ? 'Message' : event.status === 'rescheduled' ? 'Time change confirmed' : 'Time change requested'}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words">{event.note}</p>
                    </li>
                  ))}
                </ol>
                <label className="mt-3 block text-sm text-ink/65">Message
                  <textarea rows={2} maxLength={1000} value={messageDrafts[order._id] || ''} onChange={(event) => setMessageDrafts((current) => ({ ...current, [order._id]: event.target.value }))} className="mt-1 w-full border border-line bg-input px-3 py-2" />
                </label>
                <button type="button" onClick={() => run(order, 'message')} disabled={Boolean(busyId) || !messageDrafts[order._id]?.trim()} className="mt-2 min-h-11 rounded-lg border border-line px-4 text-sm font-medium disabled:opacity-50">Send message</button>
              </details>
              {order.kind === 'appointment' && order.appointmentAt && ['awaiting_payment', 'ready_to_start', 'confirmed'].includes(order.status) && order.paymentStatus !== 'processing' && (
                <section className="mt-4 rounded-lg border border-line p-3">
                  <h3 className="text-sm font-semibold">Change appointment time</h3>
                  <p className="mt-1 text-xs leading-5 text-ink/55">Send a proposed time to the provider. The current appointment stays in place until the provider confirms and the new slot is rechecked.</p>
                  {order.requestedAppointmentAt && <p className="mt-2 text-sm">Proposed: {new Date(order.requestedAppointmentAt).toLocaleString(undefined, { timeZone: order.timeZone || undefined })} ({order.timeZone})</p>}
                  {isBuyer && <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs text-ink/60">Proposed time (your local time)
                      <input type="datetime-local" value={rescheduleInputs[order._id] || ''} onChange={(event) => setRescheduleInputs((current) => ({ ...current, [order._id]: event.target.value }))} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" />
                    </label>
                    <button type="button" onClick={() => run(order, 'reschedule-request')} disabled={Boolean(busyId) || !rescheduleInputs[order._id]} className="min-h-11 rounded-lg border border-line px-4 text-sm font-medium disabled:opacity-50">Request new time</button>
                  </div>}
                  {isSeller && order.requestedAppointmentAt && <button type="button" onClick={() => run(order, 'reschedule-confirm')} disabled={Boolean(busyId)} className="mt-3 min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50">Confirm proposed time</button>}
                </section>
              )}
              {!disputed && ((isSeller && ['pending_approval', 'ready_to_start', 'confirmed', 'in_progress', 'revision_requested'].includes(order.status))
                || (isBuyer && ['pending_approval', 'awaiting_payment', 'delivered'].includes(order.status))) && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  <label className="block text-sm text-ink/65">Note <span className="text-ink/40">(optional)</span><textarea rows={2} maxLength={1000} value={notes[order._id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [order._id]: event.target.value }))} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
                  {isSeller && order.status === 'in_progress' && <label className="block text-sm text-ink/65">Deliverable link <span className="text-ink/40">(HTTPS, optional)</span><input type="url" value={deliverableUrls[order._id] || ''} onChange={(event) => setDeliverableUrls((current) => ({ ...current, [order._id]: event.target.value }))} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" /></label>}
                  <div className="flex flex-wrap gap-2">
                    {isSeller && order.status === 'pending_approval' && <><button type="button" onClick={() => run(order, 'confirm')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50">Confirm request</button><button type="button" onClick={() => run(order, 'decline')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg border border-dispute/40 px-4 text-sm text-dispute disabled:opacity-50">Decline</button></>}
                    {isBuyer && order.status === 'pending_approval' && <button type="button" onClick={() => run(order, 'cancel')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg border border-line px-4 text-sm disabled:opacity-50">Cancel request</button>}
                    {isBuyer && order.status === 'awaiting_payment' && <button type="button" onClick={() => run(order, 'checkout')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50">Continue to payment</button>}
                    {isSeller && ['ready_to_start', 'confirmed'].includes(order.status) && <button type="button" onClick={() => run(order, 'start')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50">Mark in progress</button>}
                    {isSeller && ['in_progress', 'revision_requested'].includes(order.status) && <button type="button" onClick={() => run(order, 'deliver')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50">Submit delivery</button>}
                    {isBuyer && order.status === 'delivered' && <><button type="button" onClick={() => run(order, 'accept')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50">Confirm completion</button>{order.revisionCount < order.maxRevisions && <button type="button" onClick={() => run(order, 'revision')} disabled={Boolean(busyId)} className="min-h-11 rounded-lg border border-line px-4 text-sm disabled:opacity-50">Request revision</button>}</>}
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-ink/50">{order.paymentMode === 'direct' ? 'Escrit cannot hold or recover a direct payment. Report concerns through support.' : 'Payment success is recorded only after provider verification.'}</p>
            </li>;
          })}
        </ul>
      )}
    </main>
  );
}
