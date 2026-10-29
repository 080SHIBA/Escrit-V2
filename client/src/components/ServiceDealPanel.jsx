import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';

export default function ServiceDealPanel({ service }) {
  const { status, seller } = useAuthContext();
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [location, setLocation] = useState('');
  const [attachments, setAttachments] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isOwner = String(seller?.id || seller?._id) === String(service.seller?._id);

  if (status !== 'authed') {
    return <Link to={`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`} className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg bg-ink px-4 py-3 text-center font-medium text-paper">Sign in to request a quote</Link>;
  }
  if (isOwner) return <p className="mt-5 rounded-lg border border-line p-3 text-sm text-ink/60">This is your service listing. Review incoming project requests from Service offers and chats.</p>;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { offer } = await api.createServiceOffer({
        serviceId: service._id,
        fulfilmentCriteria: description.trim(),
        budgetNaira: budget ? Number(budget) : null,
        deadline: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
        location: location.trim(),
        attachments: attachments.split('\n').map((value) => value.trim()).filter(Boolean),
        termsAccepted,
      });
      navigate(`/account/offers/${offer._id}`);
    } catch (err) {
      setError(err.message || 'Unable to send your project request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border-t border-line pt-5">
      <h2 className="text-sm font-semibold">Request a custom quote</h2>
      <p className="text-xs leading-5 text-ink/55">Share your project requirements. The provider will respond with scope, price, timeline, payment terms, and an expiry date. No booking or payment is created by this request.</p>
      <label className="block text-sm text-ink/65">Project requirements
        <textarea minLength={5} maxLength={5000} required rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-28 w-full border border-line bg-input px-3 py-2" placeholder="Describe the outcomes, constraints, and what success looks like." />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-ink/65">Optional budget (₦)
          <input type="number" min="0" value={budget} onChange={(event) => setBudget(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" />
        </label>
        <label className="block text-sm text-ink/65">Target deadline
          <input type="date" min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm text-ink/65">Location, if relevant
        <input maxLength={500} value={location} onChange={(event) => setLocation(event.target.value)} className="mt-1 min-h-11 w-full border border-line bg-input px-3 py-2" placeholder="City or service area" />
      </label>
      <label className="block text-sm text-ink/65">Reference files or links <span className="text-ink/40">(one HTTPS URL per line)</span>
        <textarea rows={2} value={attachments} onChange={(event) => setAttachments(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" />
      </label>
      <label className="flex min-h-11 items-start gap-2 text-xs leading-5 text-ink/65"><input type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" />I understand this is a request only. No service order or payment is created until I review and accept a provider quote.</label>
      {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
      <button disabled={busy} className="min-h-11 w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">{busy ? 'Sending…' : 'Send project request'}</button>
    </form>
  );
}
