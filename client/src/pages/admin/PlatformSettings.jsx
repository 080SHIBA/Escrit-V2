import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import AdminToolsNav from '../../components/admin/AdminToolsNav.jsx';

export default function PlatformSettings() {
  usePageTitle('Platform settings');
  const [commission, setCommission] = useState('5');
  const [paymentProvider, setPaymentProvider] = useState('paystack');
  const [paymentMode, setPaymentMode] = useState('test');
  const [savedMode, setSavedMode] = useState('test');
  const [configuredModes, setConfiguredModes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [removingDemoData, setRemovingDemoData] = useState(false);
  const [demoRemovalResult, setDemoRemovalResult] = useState('');
  const [promotion, setPromotion] = useState({ subject: '', title: '', message: '', path: '' });
  const [sendingPromotion, setSendingPromotion] = useState(false);
  const [promotionResult, setPromotionResult] = useState('');
  const [promotionError, setPromotionError] = useState('');
  const { seller } = useAuthContext();

  useEffect(() => {
    api.getPlatformSettings()
      .then(({ settings, configuredModes: modes }) => {
        setCommission(String(settings.commissionPercent));
        setPaymentProvider(settings.paymentProvider || 'paystack');
        setPaymentMode(settings.paymentMode || 'test');
        setSavedMode(settings.paymentMode || 'test');
        setConfiguredModes(modes || null);
      })
      .catch((err) => setError(err.message || 'Unable to load platform settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (seller?.isOwner && paymentMode === 'live' && savedMode !== 'live' &&
      !window.confirm('Switch to LIVE payments? Real cards will be charged and real payouts sent. Make sure your live keys and webhook are set up.')) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const { settings } = await api.updatePlatformSettings({
        commissionPercent: Number(commission),
        paymentProvider,
        ...(seller?.isOwner ? { paymentMode } : {}),
      });
      setCommission(String(settings.commissionPercent));
      setPaymentProvider(settings.paymentProvider);
      setPaymentMode(settings.paymentMode || 'test');
      setSavedMode(settings.paymentMode || 'test');
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Unable to save platform settings.');
    } finally {
      setSaving(false);
    }
  }

  async function removeDemoData() {
    if (!window.confirm('Remove all seeded demo sellers, listings, links, transactions, and reviews? Real accounts and categories will be kept.')) return;
    setRemovingDemoData(true);
    setDemoRemovalResult('');
    setError('');
    try {
      const { removed } = await api.removeDemoData();
      setDemoRemovalResult(`${removed.sellers} sellers, ${removed.products + removed.courses + removed.services} listings, and ${removed.transactions} transactions removed.`);
    } catch (err) {
      setError(err.message || 'Unable to remove demo data.');
    } finally {
      setRemovingDemoData(false);
    }
  }

  async function sendPromotion(event) {
    event.preventDefault();
    if (!window.confirm('Send this email to all verified accounts that opted in to promotional email?')) return;
    setSendingPromotion(true);
    setPromotionResult('');
    setPromotionError('');
    try {
      const result = await api.sendPromotionEmail(promotion);
      setPromotionResult(`Sent to ${result.deliveredCount} of ${result.recipientCount} opted-in accounts${result.failedCount ? `; ${result.failedCount} failed` : ''}.`);
      setPromotion({ subject: '', title: '', message: '', path: '' });
    } catch (err) {
      setPromotionError(err.message || 'Unable to send promotion email.');
    } finally {
      setSendingPromotion(false);
    }
  }

  return (
    <div className="w-full max-w-none">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div><p className="text-xs uppercase tracking-wider text-ink/50">Admin</p><h1 className="mt-2 font-display text-3xl">Platform settings</h1></div>
        <AdminToolsNav />
      </header>
      <div className="mt-6 grid items-start gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] xl:gap-5">
      <form onSubmit={submit} className="certificate w-full max-w-xl space-y-5 p-5 sm:p-6 xl:max-w-none">
        <div><h2 className="font-medium">Seller commission</h2><p className="mt-1 text-sm leading-6 text-ink/60">Applied to the seller’s base price when escrow is released. The processor estimate is added to the buyer-facing listing price separately.</p></div>
        <label className="block text-sm text-ink/65">Commission percentage
          <div className="mt-2 flex items-center gap-3"><input type="range" min="0" max="25" step="0.5" value={commission} onChange={(event) => setCommission(event.target.value)} className="min-w-0 flex-1" /><input type="number" min="0" max="25" step="0.5" value={commission} onChange={(event) => setCommission(event.target.value)} className="w-24 border border-line bg-input px-3 py-2 text-right" /><span>%</span></div>
        </label>
        <label className="block text-sm text-ink/65">Payment provider
          <select value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)} className="mt-2 w-full border border-line bg-input px-3 py-2">
            <option value="paystack">Paystack</option>
            <option value="flutterwave">Flutterwave</option>
          </select>
          <span className="mt-2 block text-xs leading-5 text-ink/50">Switch only after the selected provider keys, webhook, fee behavior, and payout balance have been tested in production.</span>
        </label>
        <fieldset className="block text-sm text-ink/65">
          <legend>Payment mode</legend>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Payment mode">
            {['test', 'live'].map((mode) => {
              const missingKeys = configuredModes && !configuredModes[paymentProvider]?.[mode];
              const active = paymentMode === mode;
              return (
                <button key={mode} type="button" role="radio" aria-checked={active} disabled={!seller?.isOwner || missingKeys} onClick={() => setPaymentMode(mode)} className={`flex-1 rounded-lg border px-3 py-2 capitalize disabled:opacity-40 ${active ? (mode === 'live' ? 'border-dispute bg-dispute/10 text-dispute' : 'border-ink bg-ink text-paper') : 'border-line bg-input'}`}>{mode}{missingKeys ? ' (no keys)' : ''}</button>
              );
            })}
          </div>
          <span className="mt-2 block text-xs leading-5 text-ink/50">
            {seller?.isOwner ? 'Test uses sandbox keys and moves no real money. Live charges real cards and pays out real balances.' : 'Only the platform owner can change this.'}
            {' '}Currently saved: <strong>{savedMode}</strong>.
          </span>
          {paymentMode === 'live' && <span role="status" className="mt-2 block rounded-lg border border-dispute/40 px-3 py-2 text-xs text-dispute">Live mode: real money will move.</span>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
        {saved && <p role="status" className="text-sm text-released">Settings saved.</p>}
        <button disabled={loading || saving} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{saving ? 'Saving…' : 'Save settings'}</button>
      </form>
      {seller?.isOwner && <section className="certificate mt-6 max-w-xl border border-dispute/30 p-5 sm:p-6 xl:mt-0 xl:max-w-none"><h2 className="font-medium text-dispute">Demo data cleanup</h2><p className="mt-2 text-sm leading-6 text-ink/60">Remove the seeded browse-only sellers, listings, payment links, test transactions, and related reviews. Real accounts, categories, and non-demo listings are not affected.</p><button type="button" onClick={removeDemoData} disabled={removingDemoData} className="mt-4 rounded-lg border border-dispute px-4 py-2.5 text-sm font-medium text-dispute disabled:opacity-50">{removingDemoData ? 'Removing demo data…' : 'Remove all demo data'}</button>{demoRemovalResult && <p role="status" className="mt-3 text-sm text-released">{demoRemovalResult}</p>}</section>}
      </div>
      {seller?.isOwner && <form onSubmit={sendPromotion} className="certificate mt-6 max-w-3xl space-y-4 p-5 sm:p-6">
        <div><h2 className="font-medium">Promotional email</h2><p className="mt-1 text-sm leading-6 text-ink/60">Send a marketplace update to verified accounts that opted in to promotional email. Important account notifications are managed separately.</p></div>
        <label className="block text-sm text-ink/65">Email subject<input required minLength="3" maxLength="100" value={promotion.subject} onChange={(event) => setPromotion({ ...promotion, subject: event.target.value })} className="mt-2 w-full border border-line bg-input px-3 py-2" /></label>
        <label className="block text-sm text-ink/65">Heading<input required minLength="3" maxLength="100" value={promotion.title} onChange={(event) => setPromotion({ ...promotion, title: event.target.value })} className="mt-2 w-full border border-line bg-input px-3 py-2" /></label>
        <label className="block text-sm text-ink/65">Message<textarea required minLength="10" maxLength="2000" rows="5" value={promotion.message} onChange={(event) => setPromotion({ ...promotion, message: event.target.value })} className="mt-2 w-full border border-line bg-input px-3 py-2" /></label>
        <label className="block text-sm text-ink/65">Optional link path<input maxLength="200" placeholder="/marketplace" value={promotion.path} onChange={(event) => setPromotion({ ...promotion, path: event.target.value })} className="mt-2 w-full border border-line bg-input px-3 py-2" /><span className="mt-1 block text-xs text-ink/50">Use a path on Escrit, such as /marketplace.</span></label>
        {promotionError && <p role="alert" className="text-sm text-dispute">{promotionError}</p>}
        {promotionResult && <p role="status" className="text-sm text-released">{promotionResult}</p>}
        <button disabled={sendingPromotion} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{sendingPromotion ? 'Sending…' : 'Send promotional email'}</button>
      </form>}
    </div>
  );
}
