import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

function shopDomainFromInput(value) {
  const normalized = value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  return normalized.includes('.') ? normalized : `${normalized}.myshopify.com`;
}

function initialDraftValues(draft) {
  return {
    title: draft.title || '',
    description: draft.description || '',
    category: draft.category || 'General',
    price: String(draft.price || ''),
    stock: String(draft.stock ?? 0),
    imageUrl: draft.images?.[0] || '',
  };
}

export default function ShopifyIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connection, setConnection] = useState(null);
  const [domain, setDomain] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [draftForms, setDraftForms] = useState({});
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function loadConnectedData() {
    const [{ connection: current }, { drafts: imported }] = await Promise.all([
      api.getShopifyConnection(),
      api.getShopifyDrafts(),
    ]);
    setConnection(current);
    setDrafts(imported);
    setDraftForms(Object.fromEntries(imported.map((draft) => [draft._id, initialDraftValues(draft)])));
    if (current) {
      const { orders: shopifyOrders } = await api.getShopifyOrders();
      setOrders(shopifyOrders);
    } else {
      setOrders([]);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([api.getShopifyConnection(), api.getShopifyDrafts()])
      .then(async ([connectionResponse, draftsResponse]) => {
        if (!active) return;
        setConnection(connectionResponse.connection);
        setDrafts(draftsResponse.drafts);
        setDraftForms(Object.fromEntries(draftsResponse.drafts.map((draft) => [draft._id, initialDraftValues(draft)])));
        if (connectionResponse.connection) {
          const orderResponse = await api.getShopifyOrders();
          if (active) setOrders(orderResponse.orders);
        }
      })
      .catch((err) => active && setError(err.message || 'Unable to load Shopify settings.'))
      .finally(() => {
        if (!active) return;
        const result = searchParams.get('shopify');
        if (result === 'connected') setMessage('Shopify store connected.');
        if (result === 'error') setError('Shopify could not complete the connection. Try again.');
        if (result) {
          const next = new URLSearchParams(searchParams);
          next.delete('shopify');
          setSearchParams(next, { replace: true });
        }
      });
    return () => { active = false; };
  }, []);

  async function connect(event) {
    event.preventDefault();
    setBusy('connect');
    setError('');
    setMessage('');
    try {
      const result = await api.connectShopify(shopDomainFromInput(domain));
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError(err.message || 'Unable to start Shopify authorization.');
      setBusy('');
    }
  }

  async function syncProducts() {
    setBusy('sync');
    setError('');
    setMessage('');
    try {
      const result = await api.syncShopifyProducts();
      await loadConnectedData();
      setMessage(`${result.imported} product variant${result.imported === 1 ? '' : 's'} imported as Escrit drafts${result.skipped ? `; ${result.skipped} already existed` : ''}${result.hasMore ? '. Run import again to continue' : '.'}`);
    } catch (err) {
      setError(err.message || 'Unable to import Shopify products.');
    } finally {
      setBusy('');
    }
  }

  async function submitDraft(event, draft) {
    event.preventDefault();
    setBusy(draft._id);
    setError('');
    setMessage('');
    try {
      const { listing } = await api.submitShopifyDraft(draft._id, {
        ...draftForms[draft._id],
        price: Number(draftForms[draft._id].price),
        stock: Number(draftForms[draft._id].stock),
      });
      setDrafts((current) => current.filter((item) => item._id !== draft._id));
      setDraftForms((current) => {
        const next = { ...current };
        delete next[draft._id];
        return next;
      });
      setMessage(`${listing.title} was submitted for Escrit review. It is not visible to buyers until approved.`);
    } catch (err) {
      setError(err.message || 'Unable to submit this imported product.');
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    if (!window.confirm('Remove the saved Shopify connection? This keeps imported Escrit listings unchanged. Revoke Escrit access separately in Shopify admin.')) return;
    setBusy('disconnect');
    setError('');
    setMessage('');
    try {
      await api.disconnectShopify();
      setConnection(null);
      setOrders([]);
      setMessage('Shopify store disconnected. Imported Escrit drafts were kept.');
    } catch (err) {
      setError(err.message || 'Unable to disconnect Shopify.');
    } finally {
      setBusy('');
    }
  }

  function updateDraft(id, field, value) {
    setDraftForms((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  return (
    <section className="mt-8 border-t border-line pt-7" aria-labelledby="shopify-title">
      <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Sales channels</p>
      <h2 id="shopify-title" className="mt-2 font-display text-2xl">Shopify</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
        Connect your own Shopify store to import product variants as private drafts and view recent Shopify orders. Escrit orders and escrow remain separate.
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/50">
        Enter the canonical <code>store-name.myshopify.com</code> domain—not your product URL, custom storefront URL, or the OAuth callback URL.
      </p>

      {error && <p role="alert" className="mt-4 rounded-lg border border-dispute/30 bg-dispute/5 px-3 py-2 text-sm text-dispute">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg border border-released/30 bg-released-soft px-3 py-2 text-sm text-released">{message}</p>}

      {!connection ? (
        <form onSubmit={connect} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block flex-1 text-sm text-ink/70">
            Shopify store
            <input
              required
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="store-name.myshopify.com"
              autoComplete="url"
              className="mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 py-2"
            />
          </label>
          <button disabled={Boolean(busy)} className="min-h-11 min-w-44 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-ink shadow-card-md transition-colors hover:bg-accent/90 disabled:opacity-50 sm:mb-0">
            {busy === 'connect' ? 'Connecting…' : 'Connect Shopify'}
          </button>
          <p className="text-xs leading-5 text-ink/50 sm:col-span-2">
            Enter the store’s *.myshopify.com domain. Shopify will show you the permissions Escrit requests before you approve.
          </p>
        </form>
      ) : (
        <div className="mt-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs uppercase tracking-wider text-ink/50">Connected store</p><p className="mt-1 font-medium">{connection.shopDomain}</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={syncProducts} className="min-h-10 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50">
                {busy === 'sync' ? 'Importing…' : connection.hasMoreProducts ? 'Import next batch' : 'Import Shopify products'}
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={disconnect} className="min-h-10 rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50">Disconnect</button>
            </div>
          </div>

          <h3 className="mt-7 border-t border-line pt-5 font-medium">Imported product drafts</h3>
          <p className="mt-1 text-sm text-ink/55">Review each variant, set its Escrit price and stock, then submit it for listing moderation. Imported products are not automatically published.</p>
          {drafts.length === 0 ? <p className="mt-4 text-sm text-ink/50">No unsubmitted Shopify drafts. Import products to begin.</p> : (
            <ul className="mt-4 divide-y divide-line">
              {drafts.map((draft) => {
                const form = draftForms[draft._id] || initialDraftValues(draft);
                return (
                  <li key={draft._id} className="py-5">
                    <form onSubmit={(event) => submitDraft(event, draft)} className="grid gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                      {draft.images?.[0] ? <img src={draft.images[0]} alt="" className="aspect-square w-24 rounded-lg object-cover" /> : <div className="aspect-square w-24 rounded-lg bg-paper-2" />}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-ink/55 sm:col-span-2">Listing title<input required minLength={2} maxLength={160} value={form.title} onChange={(event) => updateDraft(draft._id, 'title', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-ink" /></label>
                        <label className="text-xs text-ink/55 sm:col-span-2">Description<textarea maxLength={5000} rows={3} value={form.description} onChange={(event) => updateDraft(draft._id, 'description', event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-input px-3 py-2 text-sm text-ink" /></label>
                        <label className="text-xs text-ink/55">Category<input maxLength={80} value={form.category} onChange={(event) => updateDraft(draft._id, 'category', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-ink" /></label>
                        <label className="text-xs text-ink/55">Image URL<input type="url" value={form.imageUrl} onChange={(event) => updateDraft(draft._id, 'imageUrl', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-ink" /></label>
                        <label className="text-xs text-ink/55">Price in NGN<input required type="number" min="100" step="0.01" value={form.price} onChange={(event) => updateDraft(draft._id, 'price', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-ink" /></label>
                        <label className="text-xs text-ink/55">Stock<input required type="number" min="0" step="1" value={form.stock} onChange={(event) => updateDraft(draft._id, 'stock', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-ink" /></label>
                        <button disabled={Boolean(busy)} className="min-h-10 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-50 sm:col-span-2">
                          {busy === draft._id ? 'Submitting…' : 'Submit for Escrit review'}
                        </button>
                      </div>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="mt-5 border-t border-line pt-5 font-medium">Recent Shopify orders</h3>
          <p className="mt-1 text-xs text-ink/50">Read-only channel orders. These are not Escrit escrow transactions.</p>
          {orders.length === 0 ? <p className="mt-3 text-sm text-ink/50">No recent orders returned by Shopify.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div><p className="font-medium">{order.name}</p><p className="text-xs text-ink/50">{new Date(order.createdAt).toLocaleString()} · {order.financialStatus} · {order.fulfillmentStatus}</p><p className="mt-1 text-xs text-ink/60">{order.items.map((item) => `${item.title} × ${item.quantity}`).join(', ')}</p></div>
                  <span className="font-medium">{new Intl.NumberFormat(undefined, { style: 'currency', currency: order.total.currencyCode }).format(Number(order.total.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
