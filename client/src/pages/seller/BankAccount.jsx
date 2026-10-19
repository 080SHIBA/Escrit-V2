import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BankIcon, CheckCircleIcon, ShieldCheckIcon } from '../../components/icons.jsx';
import SpotlightTour from '../../components/SpotlightTour.jsx';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { bankAccountMocksEnabled } from '../../lib/bankAccountMocks.js';
import { friendlyBankError } from '../../lib/bankAccountState.js';
import { useBankAccount } from '../../hooks/useBankAccount.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

const TOUR_STEPS = [
  {
    selector: '[data-tour="bank-form"]',
    title: 'Add your payout account',
    body: 'Choose your bank and enter your 10-digit account number. We verify the account name before saving.',
  },
];

const SUPPORTED_BANKS = [
  { label: 'Access Bank', matches: ['access'] },
  { label: 'GTBank', matches: ['gtbank', 'guaranty trust'] },
  { label: 'First Bank', matches: ['first bank'] },
  { label: 'UBA', matches: ['uba', 'united bank for africa'] },
  { label: 'Zenith', matches: ['zenith'] },
  { label: 'Kuda', matches: ['kuda'] },
  { label: 'Opay', matches: ['opay', 'o-pay'] },
  { label: 'Moniepoint', matches: ['moniepoint'] },
  { label: 'Wema', matches: ['wema'] },
];

export function BankPage() {
  usePageTitle('Bank & payouts');
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';
  const { seller, updateSeller } = useAuthContext();
  const [replacing, setReplacing] = useState(false);
  const [toast, setToast] = useState('');
  const bank = useBankAccount({
    bankAccount: seller?.bankAccount,
    updateSeller,
  });
  const account = seller?.bankAccount;

  async function handleSave(event) {
    event.preventDefault();
    const success = await bank.save();
    if (!success) return;
    setReplacing(false);
    setToast('Bank account verified and saved.');
    window.setTimeout(() => setToast(''), 3500);
  }

  function handleReplace() {
    if (!window.confirm('Replace your verified payout account? New payouts will go to the account you verify next.')) return;
    setReplacing(true);
    bank.beginReplace();
  }

  const showLinkedAccount = Boolean(account) && !replacing;

  return (
    <main>
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-ink/60">
          <BankIcon aria-hidden="true" />
          <span className="text-sm font-medium">Payout destination</span>
        </div>
        <h1 className="font-display text-3xl leading-tight">Bank &amp; payouts</h1>
        <p className="text-ink/60 mt-2">Where your escrow money lands after buyers confirm.</p>
      </header>

      {!account && !bankAccountMocksEnabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-6 text-sm text-amber-900 dark:text-amber-100" role="status">
          You can&apos;t create payment links or get paid until a bank account is verified.
        </div>
      )}
      {bankAccountMocksEnabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-6 text-sm text-amber-900 dark:text-amber-100" role="status">
          Demo mode is enabled. Accounts and payouts shown here are mock data and are not saved or verified with a real bank.
        </div>
      )}

      <div className="grid gap-6 min-[860px]:grid-cols-[1.3fr_1fr]">
        <section aria-label="Bank account" className="min-w-0">
          {showLinkedAccount ? (
            <LinkedAccountCard account={account} onReplace={handleReplace} />
          ) : (
            <BankForm
              bank={bank}
              onSubmit={handleSave}
              nextPath={nextPath}
              showSkip={!account && !bankAccountMocksEnabled}
            />
          )}
        </section>
        <PayoutSummary state={bank.state} onRetry={bank.retryPayouts} />
      </div>

      <PayoutHistory state={bank.state} onRetry={bank.retryPayouts} />
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-released px-5 py-3 text-white shadow-lg" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      <SpotlightTour storageKey="escrit_seller_tour_bank" userId={seller?._id} steps={TOUR_STEPS} />
    </main>
  );
}

export default BankPage;

export function BankForm({ bank, onSubmit, nextPath, showSkip }) {
  const { state, form } = bank;
  const options = resolveBankOptions(state.banks);
  const canSubmit = state.banksStatus === 'success'
    && state.resolveStatus === 'success'
    && Boolean(state.resolvedAccountName)
    && state.saveStatus !== 'saving';

  return (
    <div className="certificate p-5 sm:p-6">
      <h2 className="font-display text-xl mb-1">Verify your payout account</h2>
      <p className="text-sm text-ink/60 mb-5">We&apos;ll confirm the account name with your bank before saving.</p>
      <form onSubmit={onSubmit} className="space-y-4" data-tour="bank-form">
        <label className="block">
          <span className="block text-sm text-ink/70 mb-1">Bank</span>
          {state.banksStatus === 'loading' ? (
            <div className="skeleton h-11 w-full" aria-label="Loading banks" />
          ) : state.banksStatus === 'error' ? (
            <InlineError message={state.banksError} onRetry={bank.retryBanks} />
          ) : (
            <select
              required
              value={form.bankCode}
              onChange={(event) => {
                const selected = options.find((entry) => entry.code === event.target.value);
                bank.setBank(event.target.value, selected?.name || '');
              }}
              className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <option value="" disabled>Select your bank</option>
              {options.map((entry, index) => (
                <option key={`${entry.code}-${index}`} value={entry.code}>{entry.label || entry.name}</option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="block text-sm text-ink/70 mb-1">Account number</span>
          <input
            required
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{10}"
            maxLength={10}
            minLength={10}
            value={form.accountNumber}
            onChange={(event) => bank.setAccountNumber(event.target.value)}
            placeholder="10-digit account number"
            aria-describedby="account-resolve-status"
            className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 font-mono text-base tracking-wide text-ink placeholder:text-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        </label>

        <ResolveStatus state={state} onRetry={bank.retryResolve} />

        <p className="text-sm text-ink/60">
          The account name must match the identity on your verified KYC profile.
        </p>
        {state.saveError && <p className="text-sm text-dispute" role="alert">{state.saveError}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-11 w-full rounded-lg bg-ink px-4 py-3 font-medium text-paper transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.saveStatus === 'saving' ? 'Saving and verifying…' : 'Save and verify account'}
        </button>
      </form>
      {showSkip && (
        <p className="mt-4 text-sm text-ink/50">
          <Link to={nextPath} className="min-h-11 inline-flex items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            Skip for now
          </Link>
        </p>
      )}
    </div>
  );
}

export function LinkedAccountCard({ account, onReplace }) {
  return (
    <div data-tour="bank-saved" className="certificate border-released/40 bg-released-soft p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="font-display text-xl">Linked account</h2>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-released/15 px-3 text-sm font-medium text-released">
          <CheckCircleIcon aria-hidden="true" /> Verified
        </span>
      </div>
      <dl className="space-y-4 text-sm">
        <AccountRow label="Bank" value={account.bankName} />
        <AccountRow label="Account number" value={maskAccount(account.accountNumber)} />
        <AccountRow label="Account holder" value={account.resolvedAccountName} strong />
      </dl>
      <p className="mt-5 text-sm text-ink/60">Payouts are sent to this verified account.</p>
      <button
        type="button"
        onClick={onReplace}
        className="mt-5 min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-paper/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Replace account
      </button>
    </div>
  );
}

export function PayoutSummary({ state, onRetry }) {
  return (
    <section className="certificate p-5 sm:p-6" aria-labelledby="payout-summary-title">
      <h2 id="payout-summary-title" className="font-display text-xl mb-4">Payout summary</h2>
      {state.payoutsStatus === 'loading' ? (
        <div className="grid grid-cols-2 gap-3" aria-label="Loading payout summary">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
        </div>
      ) : state.payoutsStatus === 'error' ? (
        <InlineError message={state.payoutsError} onRetry={onRetry} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <SummaryTile label="Held in escrow" amount={state.summary?.heldInEscrowKobo || 0} />
          <SummaryTile label="Paid out" amount={state.summary?.paidOutKobo || 0} />
        </div>
      )}
      <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-sm leading-relaxed text-ink/60">
        <ShieldCheckIcon className="mt-0.5 shrink-0" aria-hidden="true" />
        Funds are released after the buyer confirms delivery or service completion. A dispute pauses release while it is reviewed.
      </p>
    </section>
  );
}

export function PayoutHistory({ state, onRetry }) {
  return (
    <section className="mt-8" aria-labelledby="payout-history-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="payout-history-title" className="font-display text-2xl">Payout history</h2>
          <p className="mt-1 text-sm text-ink/60">Completed releases to your verified bank account.</p>
        </div>
      </div>
      <div className="certificate overflow-hidden">
        {state.payoutsStatus === 'loading' ? (
          <div className="space-y-3 p-5" aria-label="Loading payout history">
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
          </div>
        ) : state.payoutsStatus === 'error' ? (
          <div className="p-5"><InlineError message={state.payoutsError} onRetry={onRetry} /></div>
        ) : state.payouts.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink/60">No payouts yet. They&apos;ll appear here after your first completed order.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-paper/60 text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Order ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state.payouts.map((payout) => (
                  <tr key={payout.orderId}>
                    <td className="px-4 py-3">{formatDate(payout.releasedAt)}</td>
                    <td className="max-w-52 truncate px-4 py-3 font-mono text-xs" title={payout.orderId}>{payout.orderId}</td>
                    <td className="px-4 py-3 font-medium">{formatNaira(payout.amountKobo)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-released/15 px-2.5 py-1 text-xs font-medium capitalize text-released">{payout.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ResolveStatus({ state, onRetry }) {
  let content = null;
  if (state.resolveStatus === 'checking') {
    content = <span className="text-ink/60">Checking account…</span>;
  } else if (state.resolveStatus === 'success') {
    content = <span className="font-medium text-released">✓ {state.resolvedAccountName}</span>;
  } else if (state.resolveStatus === 'error') {
    content = (
      <span className="flex flex-wrap items-center gap-2 text-dispute">
        {state.resolveError}
        <button type="button" onClick={onRetry} className="min-h-11 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          Retry
        </button>
      </span>
    );
  }
  return (
    <div id="account-resolve-status" className="min-h-5 text-sm" aria-live="polite" aria-atomic="true">
      {content}
    </div>
  );
}

function InlineError({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-dispute/30 bg-dispute/5 p-3 text-sm" role="alert">
      <p className="text-dispute">{friendlyInlineError(message)}</p>
      <button type="button" onClick={onRetry} className="mt-2 min-h-11 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        Retry
      </button>
    </div>
  );
}

function friendlyInlineError(message) {
  if (!message || message.toLowerCase().includes('request failed')) return 'We could not load this information. Please try again.';
  return message;
}

function SummaryTile({ label, amount }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-paper/50 p-3 sm:p-4">
      <p className="text-xs leading-snug text-ink/55">{label}</p>
      <p className="mt-2 break-words font-display text-lg sm:text-xl">{formatNaira(amount)}</p>
    </div>
  );
}

function AccountRow({ label, value, strong = false }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="text-ink/60">{label}</dt>
      <dd className={`break-all text-right ${strong ? 'font-semibold text-ink' : 'text-ink'}`}>{value || '—'}</dd>
    </div>
  );
}

function resolveBankOptions(banks) {
  if (!banks?.length) return [];
  const matches = SUPPORTED_BANKS.flatMap((supported) => {
    const bank = banks.find((entry) => {
      const name = String(entry.name || '').toLowerCase();
      return supported.matches.some((match) => name.includes(match));
    });
    return bank ? [{ ...bank, label: supported.label }] : [];
  });
  return matches.length ? matches : banks.map((entry) => ({ ...entry, label: entry.name }));
}

function maskAccount(number = '') {
  return `••••${number.slice(-4)}`;
}

function formatNaira(kobo) {
  const amount = Number(kobo);
  if (!Number.isFinite(amount)) return '₦0.00';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount / 100);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(date);
}
