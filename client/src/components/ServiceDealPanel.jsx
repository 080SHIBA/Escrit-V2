import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import PaymentOptionPicker from './listing-detail/PaymentOptionPicker.jsx';

export default function ServiceDealPanel({ service }) {
  const { status, seller } = useAuthContext();
  const navigate = useNavigate();
  const [price, setPrice] = useState(service.basePrice || '');
  const [criteria, setCriteria] = useState('');
  const [appointmentAt, setAppointmentAt] = useState('');
  const [paymentMode, setPaymentMode] = useState(service.paymentOptions?.escrow ? 'escrow' : 'direct');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [directPaymentRiskAccepted, setDirectPaymentRiskAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isOwner = String(seller?.id || seller?._id) === String(service.seller?._id);

  if (status !== 'authed') {
    return <Link to={`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`} className="mt-5 flex w-full items-center justify-center rounded-lg bg-ink px-4 py-3 text-center font-medium text-paper">Sign in to discuss this service</Link>;
  }
  if (isOwner) return <p className="mt-5 rounded-lg border border-line p-3 text-sm text-ink/60">This is your service listing. View incoming proposals from your account menu.</p>;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { offer } = await api.createServiceOffer({
        serviceId: service._id,
        priceNaira: Number(price),
        fulfilmentCriteria: criteria,
        appointmentAt: appointmentAt ? new Date(appointmentAt).toISOString() : null,
        paymentMode,
        directPaymentRiskAccepted: paymentMode === 'direct' && directPaymentRiskAccepted,
        termsAccepted,
      });
      navigate(`/account/offers/${offer._id}`);
    } catch (err) {
      setError(err.message || 'Unable to send your proposal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border-t border-line pt-5">
      <h2 className="text-sm font-semibold">Propose a service deal</h2>
      <label className="block text-sm text-ink/65">Your offer (₦)
        <input type="number" min="100" required value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" />
      </label>
      <label className="block text-sm text-ink/65">What should the seller deliver?
        <textarea minLength={5} maxLength={2000} required rows={3} value={criteria} onChange={(event) => setCriteria(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" placeholder="Describe the agreed scope, outcome, and any milestones." />
      </label>
      <label className="block text-sm text-ink/65">Preferred appointment <span className="text-ink/40">(optional)</span>
        <input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" />
      </label>
      <PaymentOptionPicker options={service.paymentOptions} value={paymentMode} onChange={setPaymentMode} />
      {paymentMode === 'direct' && <>
        <p className="text-xs leading-5 text-ink/55">The seller is paid directly. Escrit cannot hold or recover the money; reporting does not guarantee a refund.</p>
        <label className="flex min-h-11 items-start gap-2 text-xs leading-5 text-ink/65"><input type="checkbox" required checked={directPaymentRiskAccepted} onChange={(event) => setDirectPaymentRiskAccepted(event.target.checked)} className="mt-1" />I understand the risks of paying the provider directly and acknowledge that Escrit cannot hold or recover the payment.</label>
      </>}
      <label className="flex min-h-11 items-start gap-2 text-xs leading-5 text-ink/65"><input type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" />I reviewed the proposal and understand the selected payment method.</label>
      {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">{busy ? 'Sending…' : 'Send proposal'}</button>
      <p className="text-xs leading-5 text-ink/50">The seller may accept or counter once. Payment is started only after the proposal is accepted.</p>
    </form>
  );
}