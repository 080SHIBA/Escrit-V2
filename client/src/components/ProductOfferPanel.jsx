import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';

export default function ProductOfferPanel({ product, isOwner: isOwnerProp }) {
  const { status, seller } = useAuthContext();
  const navigate = useNavigate();
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const productId = product.id || product._id;
  const ownerId = product.sellerId || product.seller?.id || product.seller?._id;
  const isOwner = isOwnerProp ?? String(seller?.id || seller?._id) === String(ownerId);

  if (!product.negotiable) return null;
  if (status !== 'authed') return <Link to={`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`} className="mt-3 block text-center text-sm underline underline-offset-4">Sign in to make an offer</Link>;
  if (isOwner) return <Link to="/account/price-offers" className="mt-3 block text-center text-sm underline underline-offset-4">Review buyer offers</Link>;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createProductOffer({ productId, priceNaira: Number(price) });
      navigate('/account/price-offers');
    } catch (err) {
      setError(err.message || 'Unable to send your price offer.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-5 space-y-2 border-t border-line pt-4">
    <label className="block text-sm text-ink/65">Make a one-time offer (₦)<input type="number" min="100" required value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2" /></label>
    {error && <p role="alert" className="text-xs text-dispute">{error}</p>}
    <button disabled={busy} className="w-full rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium disabled:opacity-50">{busy ? 'Sending…' : 'Send price offer'}</button>
    <p className="text-xs text-ink/50">The seller can accept or reject this offer. They cannot counter.</p>
  </form>;
}