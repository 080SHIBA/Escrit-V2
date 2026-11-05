import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import FaceLivenessCheck from '../../components/FaceLivenessCheck.jsx';
import { api } from '../../lib/api.js';
import { formatEta } from '../../lib/deliveryTrackingView.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

// WHAT: the page behind the buyer's receipt link. When the goods reach the buyer they sign here.
// Three ways to sign, all with the same effect (payment is released and the seller is told to hand over):
//   1. Face: a quick live check (blink, open mouth, turn head), no photo taken.
//   2. Fingerprint / device unlock: the phone verifies the buyer and returns a cryptographic proof.
//   3. USSD: for when there is no internet; dial a code and enter a PIN.
// WHY sign-in is required: the receipt must be signed by the buyer's own account; the link alone
// proves nothing about who is holding the phone. RequireAuth (in App.jsx) sends signed-out visitors
// to sign in and brings them straight back here.
export default function ReceiptPage() {
  usePageTitle('Sign for delivery');
  const { token } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(() => api.getReceipt(token).then(({ receipt: result }) => { setReceipt(result); setDone(result.signed); }).catch((cause) => setError(cause?.message || 'This receipt could not be opened.')), [token]);
  useEffect(() => { load(); }, [load]);

  async function signWithFace({ token: livenessToken, proof }) {
    setBusy(true); setError('');
    try { await api.signReceiptWithFace(token, { livenessToken, livenessProof: proof }); setDone(true); await load(); }
    catch (cause) { setError(cause?.message || 'We could not record your signature. Please try again.'); setMethod(''); }
    setBusy(false);
  }

  async function signWithDevice() {
    setBusy(true); setError('');
    try {
      const { options } = await api.receiptDeviceOptions(token);
      // WHY the browser library: it handles the base64 encoding WebAuthn needs and shows the phone's own fingerprint / face prompt.
      const response = await startAuthentication({ optionsJSON: options });
      await api.signReceiptWithDevice(token, response);
      setDone(true); await load();
    } catch (cause) {
      setError(cause?.name === 'NotAllowedError' ? 'The check was cancelled. Try again when you’re ready.' : cause?.message || 'The device check failed. Please try again.');
    }
    setBusy(false);
  }

  if (error && !receipt) return <main className="mx-auto max-w-md px-4 py-12 text-center"><p role="alert" className="text-dispute">{error}</p><Link to="/account/orders?role=buy" className="mt-4 inline-block underline">Back to my orders</Link></main>;
  if (!receipt) return <main className="mx-auto max-w-md px-4 py-12 text-center text-ink/60" aria-busy="true">Opening your receipt…</main>;

  const methods = receipt.methods;
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-display text-2xl">Delivery receipt</h1>
      <div className="mt-4 rounded-2xl border border-line bg-paper-2 p-4 text-sm">
        <p className="font-semibold">{receipt.title}</p>
        <p className="text-ink/65">Sold by {receipt.seller}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-ink/55">Tracking code</dt><dd className="font-mono font-semibold">{receipt.trackingCode}</dd></div>
          <div><dt className="text-xs text-ink/55">Estimated arrival</dt><dd>{formatEta(receipt.estimatedArrivalAt)}</dd></div>
        </dl>
      </div>

      {done ? (
        <div role="status" className="mt-5 rounded-2xl bg-released-soft p-4 text-released">
          <p className="font-semibold">Delivery signed</p>
          <p className="mt-1 text-sm">Thank you. Payment has been released and the seller has been told to hand over your goods.</p>
          <Link to="/account/orders?role=buy" className="mt-3 inline-block text-sm font-semibold underline">Back to my orders</Link>
        </div>
      ) : receipt.blockReason ? (
        <p role="alert" className="mt-5 rounded-2xl border border-line p-4 text-sm">{receipt.blockReason}</p>
      ) : (
        <section className="mt-5" aria-label="Sign for delivery">
          <h2 className="font-display text-lg">Has your order arrived?</h2>
          <p className="mt-1 text-sm text-ink/65">Only sign when the goods are in your hands. Signing releases payment to the seller. If something is wrong, don’t sign. Raise a dispute from your orders instead.</p>
          {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}

          {method === 'face' ? (
            <div className="mt-4">
              <FaceLivenessCheck fetchSession={() => api.startReceiptLiveness(token)} onVerified={signWithFace} onCancel={() => setMethod('')} />
              {busy && <p className="mt-3 text-center text-sm text-ink/60" role="status">Recording your signature…</p>}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <button type="button" onClick={() => setMethod('face')} className="min-h-14 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">Sign with a face check</button>
              {browserSupportsWebAuthn() && (
                methods.device
                  ? <button type="button" onClick={signWithDevice} disabled={busy} className="min-h-14 w-full rounded-xl border border-line-strong px-5 text-sm font-semibold disabled:opacity-50">{busy ? 'Waiting for your device…' : 'Sign with fingerprint or face unlock'}</button>
                  : <p className="text-xs text-ink/55">Want one-tap fingerprint signing? <Link to="/settings#signing" className="underline">Set it up in your profile</Link>.</p>
              )}
              <div className="rounded-xl border border-line p-3 text-sm">
                <p className="font-semibold">No internet? Sign by phone (USSD)</p>
                {methods.ussd ? (
                  <p className="mt-1 text-ink/70">Dial <span className="font-mono font-semibold">{methods.ussdShortcode || 'the Escrit short code'}</span> from your registered phone, enter delivery code <span className="font-mono font-semibold">{receipt.deliveryCode}</span>, then your signing PIN.</p>
                ) : (
                  <p className="mt-1 text-ink/70">Set a signing PIN and add your phone number in <Link to="/settings#signing" className="underline">your profile</Link> to use this when you have no data.</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
