import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function ProductOffers() {
  const { seller } = useAuthContext();
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const myId = String(seller?.id || seller?._id || '');
  usePageTitle('Product price offers');

  async function load() {
    try {
      const { offers: data } = await api.listProductOffers();
      setOffers(data || []);
    } catch (err) {
      setError(err.message || 'Unable to load product offers.');
    }
  }

  useEffect(() => { load(); }, []);

  async function respond(offerId, decision) {
    setBusy(offerId);
    setError('');
    try {
      await api.respondProductOffer(offerId, decision);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to respond to this offer.');
    } finally {
      setBusy('');
    }
  }

  return <div className="mx-auto max-w-5xl"><header className="border-b border-line pb-5"><p className="text-xs uppercase tracking-wider text-ink/50">Account</p><h1 className="mt-2 font-display text-3xl">Product price offers</h1></header>{error && <p role="alert" className="mt-4 text-sm text-dispute">{error}</p>}{offers === null && !error && <p className="py-8 text-sm text-ink/55">Loading offers…</p>}{offers?.length === 0 && <p className="mt-6 border-y border-line py-8 text-sm text-ink/55">No product offers yet.</p>}<ul className="mt-4 divide-y divide-line">{offers?.map((offer) => { const isSeller = String(offer.sellerId?._id) === myId; return <li key={offer._id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="flex min-w-0 items-center gap-3">{offer.productId?.images?.[0] && <img src={offer.productId.images[0]} alt="" className="h-14 w-14 rounded-md object-cover" />}<div><p className="font-medium">{offer.productId?.title || 'Product offer'}</p><p className="mt-1 text-sm text-ink/55">{isSeller ? `Offer from ${offer.buyerId?.businessName}` : <>Seller: <Link to={`/marketplace/seller/${offer.sellerId?._id}`} className="hover:text-accent hover:underline">{offer.sellerId?.displayName || offer.sellerId?.businessName}</Link></>} · {offer.status.toLowerCase()}</p><p className="mt-1 font-mono text-sm">₦{(offer.proposedPriceKobo / 100).toLocaleString()}</p></div></div><div className="flex flex-wrap gap-2">{offer.status === 'PROPOSED' && isSeller && <><button disabled={busy === offer._id} onClick={() => respond(offer._id, 'accept')} className="rounded-md bg-released px-3 py-2 text-xs font-medium text-paper disabled:opacity-50">Accept</button><button disabled={busy === offer._id} onClick={() => respond(offer._id, 'reject')} className="rounded-md border border-dispute/40 px-3 py-2 text-xs font-medium text-dispute disabled:opacity-50">Reject</button></>}{offer.status === 'ACCEPTED' && !isSeller && offer.linkId && <Link to={`/r/${offer.linkId}`} className="rounded-md bg-ink px-3 py-2 text-xs font-medium text-paper">Buy with escrow</Link>}</div></li>; })}</ul></div>;
}