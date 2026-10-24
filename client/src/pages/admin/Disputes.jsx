import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { AlertIcon, ShieldCheckIcon } from '../../components/icons.jsx';
import AdminToolsNav from '../../components/admin/AdminToolsNav.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

// Admin queue for open disputes. Access is enforced by the API
// (ADMIN_EMAILS allowlist); anyone else sees a 403 message.
export default function Disputes() {
  usePageTitle('Open disputes');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [notes, setNotes] = useState({}); // { [transactionId]: noteText }

  useEffect(() => {
    load();
  }, []);

  function load() {
    api
      .listDisputes()
      .then((d) => setData(d.disputes))
      .catch((err) => setError(err.message));
  }

  async function resolve(id, outcome) {
    const note = (notes[id] || '').trim();
    if (note.length < 10) {
      setError('Add a note of at least 10 characters explaining this decision. The buyer and seller both see it.');
      return;
    }
    setError(null);
    setResolvingId(id);
    try {
      await api.resolveDispute(id, { outcome, note });
      setData((rows) => rows.filter((r) => r.transaction._id !== id));
      setNotes((n) => {
        const { [id]: _omit, ...rest } = n;
        return rest;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="w-full max-w-none animate-fade-in-up">
      <h1 className="mb-1 font-display text-2xl lg:hidden">Open disputes</h1>
      <header className="mb-6 hidden flex-wrap items-end justify-between gap-4 border-b border-line pb-5 lg:flex">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/50">Admin</p>
          <h1 className="mt-2 font-display text-3xl">Open disputes</h1>
        </div>
        <AdminToolsNav />
      </header>
      <p className="text-ink/60 mb-3">
        Releasing pays the seller. Refunding returns the money to the buyer.
      </p>
      <p className="flex items-start gap-2 text-xs text-ink/50 certificate p-3 mb-6">
        <ShieldCheckIcon width={14} height={14} className="shrink-0 mt-0.5" />
        <span>
          The note you write is saved on the order and shown word for word to both the buyer and the
          seller as the reason for your decision.
        </span>
      </p>

      {error && (
        <p className="text-dispute text-sm mb-4 flex items-center gap-1.5 break-words" role="alert">
          <AlertIcon width={14} height={14} className="shrink-0" /> {error}
        </p>
      )}

      {!data && !error && (
        <div className="space-y-3">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      )}

      {data?.length === 0 && (
        <p className="text-ink/60 certificate p-6 text-center">No open disputes right now.</p>
      )}

      <ul className="space-y-4">
        {data?.map(({ transaction, link, seller }) => (
          <li key={transaction._id} className="certificate border-dispute/40 p-4 animate-fade-in-up lg:rounded-2xl lg:border lg:shadow-card-md lg:p-5">
            <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium break-words">{link?.itemName || 'Unknown item'}</p>
                <p className="text-sm text-ink/60 break-words">
                  <span className="font-mono">₦{((link?.priceKobo || 0) / 100).toLocaleString()}</span> · buyer: {transaction.buyerEmail || '—'} · seller: {seller?.businessName || 'unknown'} ({seller?.email || '—'})
                </p>
              </div>
              <span className="text-xs text-ink/50 whitespace-nowrap">
                {transaction.disputeRaisedAt && new Date(transaction.disputeRaisedAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm bg-dispute-soft border border-dispute/30 rounded-lg p-2.5 mb-3 break-words">
              {transaction.disputeReason}
            </p>

            {link?.itemDescription && <div className="mb-3 border-l-2 border-seal pl-3"><p className="text-xs font-medium uppercase tracking-wide text-ink/50">Agreed fulfillment criteria</p><p className="mt-1 whitespace-pre-line text-sm leading-5 text-ink/70">{link.itemDescription}</p></div>}
            {transaction.evidence?.length > 0 && <div className="mb-4 space-y-3 border-y border-line py-3"><h3 className="text-xs font-medium uppercase tracking-wide text-ink/50">Evidence thread</h3>{transaction.evidence.map((entry) => <div key={entry._id} className="border-l-2 border-line pl-3 text-sm"><p className="text-xs font-medium text-ink/55">{entry.party} · {new Date(entry.createdAt).toLocaleString()}</p>{entry.text && <p className="mt-1 whitespace-pre-line text-ink/75">{entry.text}</p>}{entry.mediaUrl && <a href={entry.mediaUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline underline-offset-4">Open evidence attachment</a>}</div>)}</div>}

            <label className="block mb-3">
              <span className="text-sm text-ink/70">Resolution note (shown to both sides)</span>
              <textarea
                rows={2}
                value={notes[transaction._id] || ''}
                onChange={(e) => setNotes((n) => ({ ...n, [transaction._id]: e.target.value }))}
                placeholder="e.g. Seller provided a delivery receipt matching the buyer's address, so funds were released."
                className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg text-sm"
              />
            </label>

            <div className="flex flex-col xs:flex-row gap-2">
              <button
                disabled={resolvingId === transaction._id}
                onClick={() => resolve(transaction._id, 'release')}
                className="flex-1 border border-released text-released py-2 text-sm font-medium hover:bg-released hover:text-paper transition-colors disabled:opacity-50 rounded-lg"
              >
                Release to seller
              </button>
              <button
                disabled={resolvingId === transaction._id}
                onClick={() => resolve(transaction._id, 'refund')}
                className="flex-1 border border-dispute text-dispute py-2 text-sm font-medium hover:bg-dispute hover:text-paper transition-colors disabled:opacity-50 rounded-lg"
              >
                Refund buyer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
