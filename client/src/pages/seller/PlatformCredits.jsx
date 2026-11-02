import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function PlatformCredits() {
  usePageTitle('Promotion credits');
  const [data, setData] = useState(null);
  const [listings, setListings] = useState([]);
  const [selection, setSelection] = useState('');
  const [perk, setPerk] = useState('promote');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      // WHY allSettled: the credit balance and the seller's listings are
      // independent, so one failing should not hide the other.
      const [creditsResult, listingsResult] = await Promise.allSettled([api.getPlatformCredits(), api.getMyListings()]);
      if (creditsResult.status === 'rejected') throw creditsResult.reason;
      const credits = creditsResult.value;
      const ownedListings = listingsResult.status === 'fulfilled' ? listingsResult.value : { listings: [] };
      if (listingsResult.status === 'rejected') setError('Your listings could not be loaded, so promotions are unavailable right now. Refresh to try again.');
      setData(credits);
      setListings((ownedListings.listings || []).filter((listing) => listing.isVerified));
      setSelection((current) => current || (ownedListings.listings || []).find((listing) => listing.isVerified)?._id || '');
    } catch (err) {
      setError(err.message || 'Unable to load promotion credits.');
    }
  }

  useEffect(() => { load(); }, []);

  async function spend(event) {
    event.preventDefault();
    const listing = listings.find((entry) => entry._id === selection);
    if (!listing) return;
    setBusy(true);
    setError('');
    try {
      await api.spendPlatformCredits({ listingType: listing.listingType, listingId: listing._id, perk });
      await load();
    } catch (err) {
      setError(err.message || 'Unable to redeem promotion credits.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-5xl"><header className="border-b border-line pb-5"><p className="text-xs uppercase tracking-wider text-ink/50">Seller tools</p><h1 className="mt-2 font-display text-3xl">Promotion credits</h1></header>{error && <p role="alert" className="mt-4 text-sm text-dispute">{error}</p>}{data && <><section className="mt-6 border-y border-seal/30 py-5"><p className="text-xs uppercase tracking-wider text-ink/50">Available balance</p><p className="mt-1 font-mono text-3xl font-semibold">₦{(data.balanceKobo / 100).toLocaleString()}</p></section><form onSubmit={spend} className="mt-6 grid gap-4 border-b border-line pb-6 md:grid-cols-[1fr_14rem_auto] md:items-end"><label className="text-sm text-ink/65">Verified listing<select required value={selection} onChange={(event) => setSelection(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2"><option value="">Choose listing</option>{listings.map((listing) => <option key={listing._id} value={listing._id}>{listing.title}</option>)}</select></label><label className="text-sm text-ink/65">Promotion<select value={perk} onChange={(event) => setPerk(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2"><option value="promote">Promote · ₦5,000</option><option value="feature">Feature · ₦10,000</option></select></label><button disabled={busy || !selection} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{busy ? 'Applying…' : 'Redeem credits'}</button></form><p className="mt-3 text-xs leading-5 text-ink/50">Featured placement marks a listing for priority display. Promotion entries are recorded in your credit history.</p><section className="mt-8"><h2 className="font-display text-xl">Credit activity</h2>{data.entries.length === 0 ? <p className="mt-3 text-sm text-ink/55">No credit activity yet.</p> : <ul className="mt-3 divide-y divide-line border-y border-line">{data.entries.map((entry) => <li key={entry._id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p className="font-medium">{entry.reason}</p><p className="mt-1 text-xs text-ink/50">{new Date(entry.createdAt).toLocaleString()}</p></div><span className={`font-mono ${entry.amountKobo >= 0 ? 'text-released' : 'text-ink/70'}`}>{entry.amountKobo > 0 ? '+' : ''}₦{(entry.amountKobo / 100).toLocaleString()}</span></li>)}</ul>}</section></>}{!data && !error && <p className="py-8 text-sm text-ink/55">Loading credits…</p>}<Link to="/dashboard" className="mt-6 inline-block text-sm underline underline-offset-4">Back to account hub</Link></div>;
}