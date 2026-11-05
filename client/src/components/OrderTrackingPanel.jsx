import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatEta, receiptPath } from '../lib/deliveryTrackingView.js';

// WHAT: one order's own tracking: its code, arrival estimate and timeline, plus (for the buyer) the
// button to sign for the delivery and (for the seller) a form to post progress.
// WHY per order: every order is delivered separately by a different person, so each keeps its own
// code, history and estimate; nothing is shared across the buyer's other orders.
const STATUS_CHOICES = [
  ['PROCESSING', 'Preparing the order'],
  ['PACKED', 'Packed and ready'],
  ['SHIPPED', 'On its way'],
  ['OUT_FOR_DELIVERY', 'Out for delivery'],
  ['ARRIVED', 'Arrived, awaiting handover'],
];

export default function OrderTrackingPanel({ order, role }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ status: 'SHIPPED', note: '', estimatedArrivalAt: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.getOrderTracking(order.id).then((result) => { if (active) setData(result); }).catch((cause) => { if (active) setError(cause?.message || 'Tracking could not be loaded.'); });
    return () => { active = false; };
  }, [order.id, order.signed]);

  async function post(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { status: form.status, note: form.note };
      if (form.estimatedArrivalAt) body.estimatedArrivalAt = new Date(form.estimatedArrivalAt).toISOString();
      const result = await api.postOrderTracking(order.id, body);
      setData((current) => ({ ...current, timeline: result.timeline, estimatedArrivalAt: result.estimatedArrivalAt, sellerHasPosted: true }));
      setForm((current) => ({ ...current, note: '' }));
    } catch (cause) {
      setError(cause?.message || 'That update could not be saved.');
    }
    setSaving(false);
  }

  return (
    <section className="rounded-xl border border-line bg-paper p-4" aria-label={`Tracking for ${order.title}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-ink/55">Tracking code</p>
          <p className="font-mono text-base font-semibold tracking-wide">{order.trackingCode}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink/55">Estimated arrival</p>
          <p className="text-sm font-medium">{formatEta(data?.estimatedArrivalAt ?? order.estimatedArrivalAt)}</p>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}

      {data && (
        <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
          {data.timeline.map((item, index) => (
            <li key={`${item.status}-${index}`} className="relative text-sm">
              <span aria-hidden="true" className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ${item.status === 'DELIVERED' ? 'bg-released' : 'bg-accent'}`} />
              <p className="font-medium">{item.label}</p>
              {item.note && <p className="text-ink/65">{item.note}</p>}
              <p className="text-xs text-ink/50">{new Date(item.at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </li>
          ))}
        </ol>
      )}
      {data && !data.sellerHasPosted && !data.signed && (
        <p className="mt-3 text-xs text-ink/60">The seller hasn’t posted delivery updates yet. You can still sign for the delivery the moment it reaches you.</p>
      )}

      {role === 'buy' && order.receiptUrl && !order.signed && (
        <div className="mt-4 rounded-lg bg-paper-2 p-3 text-sm">
          <p className="font-medium">When your goods arrive</p>
          <p className="mt-1 text-ink/65">Open the receipt and sign with a face check or your fingerprint, or by phone with USSD if you have no data. This releases payment and tells the seller to hand over.</p>
          <Link to={receiptPath(order.receiptUrl)} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">Sign for delivery</Link>
        </div>
      )}

      {role === 'sell' && !order.signed && order.stage === 1 && (
        <form onSubmit={post} className="mt-4 space-y-3 rounded-lg bg-paper-2 p-3 text-sm">
          <p className="font-medium">Post a delivery update</p>
          <label className="block">Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3">
              {STATUS_CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block">Estimated arrival (optional)
            <input type="datetime-local" value={form.estimatedArrivalAt} onChange={(event) => setForm({ ...form, estimatedArrivalAt: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3" />
          </label>
          <label className="block">Note (optional)
            <input maxLength={300} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3" placeholder="e.g. Rider will call before arriving" />
          </label>
          <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-50">{saving ? 'Posting…' : 'Post update'}</button>
        </form>
      )}
      {role === 'sell' && order.signed && <p className="mt-4 rounded-lg bg-released-soft p-3 text-sm font-medium text-released">The buyer signed for this delivery. Hand over the goods now.</p>}
    </section>
  );
}
