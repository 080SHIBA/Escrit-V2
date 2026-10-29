import { useState } from 'react';
import { paymentOptionCopy } from '../../lib/serviceChat.js';

function money(kobo) {
  return `₦${(Number(kobo || 0) / 100).toLocaleString('en-NG')}`;
}

export default function PayBar({ offer, order, busy, onPay }) {
  const options = offer?.paymentOptionsSnapshot || {
    escrow: offer?.paymentMode === 'escrow',
    direct: offer?.paymentMode === 'direct',
  };
  const available = ['escrow', 'direct'].filter((mode) => options[mode]);
  const [paymentMode, setPaymentMode] = useState(offer?.paymentMode || available[0] || 'escrow');
  const [riskAccepted, setRiskAccepted] = useState(false);

  if (!order || order.paymentStatus === 'processing') {
    return (
      <p role="status" className="rounded-xl border border-accent/25 bg-accent/5 p-4 text-sm leading-6">
        Waiting for the payment provider to confirm. The order will move forward only after Escrit verifies the payment.
      </p>
    );
  }
  if (order.paymentStatus === 'paid') return null;

  return (
    <section className="rounded-xl border border-accent/30 bg-paper p-4 sm:p-5" aria-labelledby="pay-service-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="pay-service-heading" className="font-semibold">Ready when you are</h3>
        <p className="font-display text-xl font-semibold">{money(order.amountKobo)}</p>
      </div>
      {available.length > 1 ? (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Choose a payment option</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {available.map((mode) => (
              <label key={mode} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${paymentMode === mode ? 'border-accent bg-accent/5' : 'border-line'}`}>
                <input type="radio" name={`payment-mode-${order._id}`} value={mode} checked={paymentMode === mode} onChange={() => { setPaymentMode(mode); setRiskAccepted(false); }} className="h-4 w-4 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" />
                <span>{mode === 'escrow' ? 'Use Escrit escrow' : 'Pay without escrow'}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mt-3 text-sm text-ink/65">{available[0] === 'escrow' ? 'Payment option: Escrit escrow' : 'Payment option: without escrow'}</p>
      )}
      <p className="mt-3 text-sm leading-6 text-ink/65">{paymentOptionCopy(paymentMode)}</p>
      {paymentMode === 'direct' && (
        <label className="mt-3 flex min-h-11 items-start gap-3 text-sm leading-5 text-ink/65">
          <input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" />
          I understand Escrit cannot hold or recover direct payments.
        </label>
      )}
      <button
        type="button"
        disabled={busy || (paymentMode === 'direct' && !riskAccepted)}
        onClick={() => onPay({ paymentMode, directPaymentRiskAccepted: riskAccepted })}
        className="mt-4 min-h-11 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus sm:w-auto"
      >
        {busy ? 'Opening payment…' : `Pay now · ${money(order.amountKobo)}`}
      </button>
    </section>
  );
}
