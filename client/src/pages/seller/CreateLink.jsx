import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { BankIcon } from '../../components/icons.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import SpotlightTour from '../../components/SpotlightTour.jsx';
import PhotoField from '../../components/PhotoField.jsx';

// One step per field, in the order they appear on the form.
const TOUR_STEPS = [
  {
    selector: '[data-tour="create-item-name"]',
    title: 'Name what you are selling',
    body: 'Keep it short and specific. This is the first thing the buyer reads, so it should match their item.',
  },
  {
    selector: '[data-tour="create-description"]',
    title: 'Describe it',
    body: 'Add condition, size and what is included. A clear description means fewer disputes later.',
  },
  {
    selector: '[data-tour="create-photo"]',
    title: 'Show it',
    body: 'Upload a photo from your phone or paste an image link. Buyers trust a listing they can see.',
  },
  {
    selector: '[data-tour="create-price"]',
    title: 'Set the price',
    body: 'The buyer pays this amount into escrow at checkout. You receive it once they confirm delivery.',
  },
  {
    selector: '[data-tour="create-submit"]',
    title: 'Create your link',
    body: 'This makes one shareable link. Any number of buyers can use it, and each order is tracked separately.',
  },
];

const FIELD = 'mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg';

export default function CreateLink() {
  usePageTitle('New payment link');
  const navigate = useNavigate();
  const { hasBankAccount, seller } = useAuthContext();
  const [form, setForm] = useState({ itemName: '', itemDescription: '', priceNaira: '', itemPhotoUrl: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // The API enforces this too; showing it here avoids a failed submit.
  if (seller?.kycStatus !== 'verified') {
    return (
      <div className="certificate p-6 text-center">
        <h1 className="mb-2 font-display text-xl">Verify your identity first</h1>
        <p className="mx-auto mb-5 max-w-sm text-ink/60">Identity verification and a verified bank account are required before creating payment links.</p>
        <Link to="/settings" className="inline-flex min-h-11 items-center rounded-lg bg-ink px-5 font-medium text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Go to Profile &amp; KYC</Link>
      </div>
    );
  }
  if (!hasBankAccount) {
    return (
      <div className="certificate p-6 text-center animate-fade-in-up">
        <BankIcon className="mx-auto text-seal mb-2" width={28} height={28} />
        <h1 className="font-display text-xl mb-2">Add a bank account first</h1>
        <p className="text-ink/60 mb-5 max-w-sm mx-auto">
          A payment link needs a verified account to pay out to. It is also what buyers rely on to trust you.
        </p>
        <Link
          to="/dashboard/bank?next=/dashboard/new"
          className="inline-block bg-ink text-paper px-5 py-3 font-medium hover:bg-ink/90 transition-colors rounded-lg"
        >
          Add bank details
        </Link>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { link } = await api.createLink({
        ...form,
        itemPhotoUrl: form.itemPhotoUrl.trim() || null,
        priceNaira: Number(form.priceNaira),
      });
      navigate(`/dashboard/links/${link._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="font-display text-2xl mb-6">New payment link</h1>
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block" data-tour="create-item-name">
          <span className="text-sm text-ink/70">Item name</span>
          <input
            required
            value={form.itemName}
            onChange={set('itemName')}
            placeholder="e.g. Vintage denim jacket, size M"
            className={FIELD}
          />
        </label>

        <label className="block" data-tour="create-description">
          <span className="text-sm text-ink/70">Description</span>
          <textarea
            rows={3}
            value={form.itemDescription}
            onChange={set('itemDescription')}
            placeholder="Condition, size, what is included…"
            className={FIELD}
          />
        </label>

        <div data-tour="create-photo">
          <PhotoField value={form.itemPhotoUrl} onChange={(url) => setForm((f) => ({ ...f, itemPhotoUrl: url }))} />
        </div>

        <label className="block" data-tour="create-price">
          <span className="text-sm text-ink/70">Price (₦)</span>
          <input
            type="number"
            inputMode="numeric"
            min="100"
            step="1"
            required
            value={form.priceNaira}
            onChange={set('priceNaira')}
            placeholder="Minimum ₦100"
            className={FIELD}
          />
        </label>

        {error && (
          <p className="text-dispute text-sm animate-fade-in-up" role="alert">
            {error}
          </p>
        )}

        <button
          data-tour="create-submit"
          disabled={loading}
          className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg"
        >
          {loading ? 'Creating…' : 'Create link'}
        </button>
      </form>
      <SpotlightTour storageKey="escrit_seller_tour_createlink" userId={seller?._id} steps={TOUR_STEPS} />
    </div>
  );
}
