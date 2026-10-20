import { usePageTitle } from '../../lib/usePageTitle.js';
import { usePreferences } from '../../hooks/usePreferences.js';
import {
  FULFILMENT_DEFAULT_LABELS,
  PAYMENT_DEFAULT_LABELS,
} from '../../lib/transactionPreferences.js';

const CARD_CLASS = 'rounded-2xl border border-line bg-paper p-5 shadow-card sm:p-6';
const OPTION_CLASS = 'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-focus';

function RadioCard({ name, value, selected, onChange, children, description }) {
  return (
    <label className={`${OPTION_CLASS} ${selected ? 'border-accent/50 bg-accent/5' : ''}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
      />
      <span>
        <span className="block font-semibold">{children}</span>
        {description && <span className="mt-1 block text-xs leading-5 text-ink/60">{description}</span>}
      </span>
    </label>
  );
}

export default function TransactionPreferencesPage() {
  usePageTitle('Transaction preferences');
  const { preferences, loading, saving, saved, error, updatePreferences } = usePreferences();

  if (loading) {
    return <main className="mx-auto max-w-3xl space-y-4" aria-busy="true" aria-label="Loading transaction preferences"><div className="skeleton h-10 w-64" /><div className="skeleton h-48 w-full" /><div className="skeleton h-40 w-full" /></main>;
  }

  return (
    <main className="mx-auto max-w-3xl">
      <header className="mb-6 border-b border-line pb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Your account</p>
        <h1 className="mt-2 font-display text-3xl">Transaction preferences</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">Set your defaults once. Each listing can override them. Order terms are saved at the time of purchase.</p>
      </header>

      <div className="space-y-4">
        <section className={CARD_CLASS} aria-labelledby="preferences-payment-heading">
          <h2 id="preferences-payment-heading" className="font-display text-xl">Payment options</h2>
          <div role="radiogroup" aria-labelledby="preferences-payment-heading" className="mt-4 space-y-2">
            <RadioCard
              name="payment-default"
              value="both"
              selected={preferences.paymentDefault === 'both'}
              onChange={(paymentDefault) => updatePreferences({ paymentDefault })}
              description="Buyers choose at checkout. This is the default for new sellers."
            >
              {PAYMENT_DEFAULT_LABELS.both}
            </RadioCard>
            <RadioCard
              name="payment-default"
              value="escrow"
              selected={preferences.paymentDefault === 'escrow'}
              onChange={(paymentDefault) => updatePreferences({ paymentDefault })}
            >
              {PAYMENT_DEFAULT_LABELS.escrow}
            </RadioCard>
            <RadioCard
              name="payment-default"
              value="direct"
              selected={preferences.paymentDefault === 'direct'}
              onChange={(paymentDefault) => updatePreferences({ paymentDefault })}
              description="Escrit cannot hold or recover this money, but buyers can still report problems."
            >
              {PAYMENT_DEFAULT_LABELS.direct}
            </RadioCard>
          </div>
        </section>

        <section className={CARD_CLASS} aria-labelledby="preferences-fulfilment-heading">
          <h2 id="preferences-fulfilment-heading" className="font-display text-xl">Physical items</h2>
          <div role="radiogroup" aria-labelledby="preferences-fulfilment-heading" className="mt-4 space-y-2">
            {Object.entries(FULFILMENT_DEFAULT_LABELS).map(([value, label]) => (
              <RadioCard
                key={value}
                name="fulfilment-default"
                value={value}
                selected={preferences.fulfilmentDefault === value}
                onChange={(fulfilmentDefault) => updatePreferences({ fulfilmentDefault })}
              >
                {label}
              </RadioCard>
            ))}
          </div>
        </section>

        <section className={CARD_CLASS} aria-labelledby="preferences-completion-heading">
          <h2 id="preferences-completion-heading" className="font-display text-xl">Completion</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">On escrow orders, the buyer confirms completion. If they do not respond, Escrit sets the default window for the order. This does not apply to payments without escrow.</p>
        </section>
      </div>

      <p role={error ? 'alert' : 'status'} aria-live="polite" className={`mt-4 min-h-11 text-sm ${error ? 'text-dispute' : 'text-released'}`}>
        {error || (saving ? 'Saving…' : saved ? 'Saved. Listings that use your default follow it.' : '')}
      </p>
    </main>
  );
}
