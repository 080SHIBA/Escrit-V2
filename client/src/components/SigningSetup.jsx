import { useEffect, useState } from 'react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '../lib/api.js';

// WHAT: lets a buyer prepare the two offline-friendly ways to sign for a delivery:
//   * a signing PIN (for USSD, when there is no internet), and
//   * their phone's fingerprint / face unlock (WebAuthn).
// WHY set up in advance: both must exist BEFORE the delivery arrives; a buyer standing at the door
// with no data cannot register a device or choose a PIN then.
export default function SigningSetup() {
  const [status, setStatus] = useState(null);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.getSigningSetup().then(setStatus).catch(() => {});
  useEffect(() => { load(); }, []);

  async function savePin(event) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try { await api.setSigningPin({ pin, password }); setPin(''); setPassword(''); setMessage('Signing PIN saved.'); await load(); }
    catch (cause) { setError(cause?.message || 'The PIN could not be saved.'); }
    setBusy(false);
  }

  async function registerDevice() {
    setBusy(true); setError(''); setMessage('');
    try {
      const { options } = await api.deviceRegisterOptions();
      const response = await startRegistration({ optionsJSON: options });
      await api.deviceRegister(response, 'This device');
      setMessage('This device can now sign deliveries with your fingerprint or face unlock.');
      await load();
    } catch (cause) {
      setError(cause?.name === 'NotAllowedError' ? 'Setup was cancelled.' : cause?.message || 'This device could not be registered.');
    }
    setBusy(false);
  }

  return (
    <section id="signing" className="mt-8 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-display text-xl">Delivery signing</h2>
      <p className="mt-1 text-sm text-ink/60">Set these up now so you can confirm a delivery even without internet.</p>
      {message && <p role="status" className="mt-3 text-sm font-medium text-released">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}

      <form onSubmit={savePin} className="mt-4 space-y-3">
        <h3 className="text-sm font-semibold">Signing PIN for USSD {status?.hasPin && <span className="ml-1 text-xs font-normal text-released">(set)</span>}</h3>
        {status && !status.hasPhone && <p className="text-xs text-dispute">Add your phone number to your profile first. USSD signing only works from that number.</p>}
        <label className="block text-sm">New PIN (4 to 6 digits)
          <input inputMode="numeric" autoComplete="off" pattern="\d{4,6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3" />
        </label>
        <label className="block text-sm">Your account password
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3" />
        </label>
        <button type="submit" disabled={busy || pin.length < 4 || !password} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-50">Save PIN</button>
      </form>

      {browserSupportsWebAuthn() && (
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">Fingerprint or face unlock on this device {status?.devices?.length > 0 && <span className="ml-1 text-xs font-normal text-released">({status.devices.length} registered)</span>}</h3>
          <p className="mt-1 text-xs text-ink/60">Your phone checks your fingerprint or face. Escrit never receives your biometrics.</p>
          <button type="button" onClick={registerDevice} disabled={busy} className="mt-3 min-h-11 rounded-xl border border-line-strong px-5 text-sm font-semibold disabled:opacity-50">Register this device</button>
        </div>
      )}
    </section>
  );
}
