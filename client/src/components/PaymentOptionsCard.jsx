import { Link } from 'react-router-dom';
import {
  PAYMENT_DEFAULT_LABELS,
  paymentOptionsForDefault,
  paymentOptionsLabel,
  validPaymentOptions,
} from '../lib/transactionPreferences.js';

const CARD_CLASS = 'rounded-2xl border border-line bg-paper p-5 shadow-card sm:p-6 lg:p-8';
const SWITCH_CLASS = 'h-5 w-5 shrink-0 accent-ink';

function Switch({ checked, onChange, children, description }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-focus">
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} className={`${SWITCH_CLASS} mt-0.5`} />
      <span className="min-w-0">
        <span className="block font-semibold">{children}</span>
        <span className="mt-1 block text-xs leading-5 text-ink/60">{description}</span>
      </span>
    </label>
  );
}

export default function PaymentOptionsCard({
  paymentDefault = 'both',
  paymentOptions = paymentOptionsForDefault(paymentDefault),
  overridesDefault = false,
  onChange,
}) {
  const effectiveOptions = overridesDefault ? paymentOptions : paymentOptionsForDefault(paymentDefault);

  function updateOption(option, enabled) {
    onChange({
      overridesDefault: true,
      paymentOptions: { ...effectiveOptions, [option]: enabled },
    });
  }

  function useDefault() {
    onChange({
      overridesDefault: false,
      paymentOptions: paymentOptionsForDefault(paymentDefault),
    });
  }

  return (
    <section className={CARD_CLASS} aria-labelledby="payment-options-heading">
      <h2 id="payment-options-heading" className="font-display text-xl lg:text-2xl">Payment options</h2>
      <p className="mt-1 text-sm font-medium">Escrow is optional.</p>
      <p className="mt-2 text-sm text-ink/60">
        Your account default: <span className="font-semibold text-ink">{PAYMENT_DEFAULT_LABELS[paymentDefault]}</span>{' '}
        <Link to="/account/transaction-preferences" className="min-h-11 inline-flex items-center text-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Change default</Link>
      </p>
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-2 border-y border-line py-2 text-sm">
        <span>{overridesDefault ? 'Using custom options for this listing' : 'Using your default'}</span>
        <button
          type="button"
          onClick={overridesDefault ? useDefault : () => onChange({ overridesDefault: true, paymentOptions: effectiveOptions })}
          className="min-h-11 rounded-lg px-2 font-semibold text-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {overridesDefault ? 'Use account default' : 'Change for this listing'}
        </button>
      </div>
      {overridesDefault ? (
        <div className="mt-4 space-y-3">
          <Switch
            checked={Boolean(effectiveOptions.escrow)}
            onChange={(enabled) => updateOption('escrow', enabled)}
            description="Payment is held until the buyer confirms completion or the default window ends."
          >
            Offer Escrit escrow
          </Switch>
          <Switch
            checked={Boolean(effectiveOptions.direct)}
            onChange={(enabled) => updateOption('direct', enabled)}
            description="The buyer pays the seller directly. Escrit cannot hold or recover this money, but buyers can still report problems."
          >
            Allow payment without escrow
          </Switch>
          {!validPaymentOptions(effectiveOptions) && (
            <p role="alert" className="text-sm font-medium text-dispute">Choose at least one payment option.</p>
          )}
          {effectiveOptions.escrow && effectiveOptions.direct && (
            <p className="text-sm text-ink/60">Buyers choose at checkout.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/65">
          {effectiveOptions.escrow && effectiveOptions.direct
            ? 'Buyers can choose escrow or pay without escrow.'
            : effectiveOptions.escrow
              ? 'Escrow only.'
              : 'Payment without escrow only.'}
        </p>
      )}
      {effectiveOptions.direct && (
        <p className="mt-2 text-xs leading-5 text-ink/55">
          Without escrow, Escrit cannot hold or recover the money. Buyers can still report problems.
        </p>
      )}
    </section>
  );
}
