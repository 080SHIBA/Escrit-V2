import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { api } from '../../lib/api.js';
import PhotoField from '../../components/PhotoField.jsx';
import ShopifyIntegration from '../../components/ShopifyIntegration.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function ProfileSettings() {
  usePageTitle('Profile settings');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { seller, refreshSeller } = useAuthContext();
  const [form, setForm] = useState({ businessName: '', fullName: '', nin: '', idDocumentUrl: '', bio: '', profilePictureUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!seller) return;
    setForm({
      businessName: seller.businessName || '',
      fullName: seller.fullName || '',
      nin: seller.nin || '',
      idDocumentUrl: seller.idDocumentUrl || '',
      bio: seller.bio || '',
      profilePictureUrl: seller.profilePictureUrl || '',
    });
  }, [seller]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await api.updateSellerProfile(form);
      await refreshSeller();
      setSaved(true);
      const requestedPath = searchParams.get('next');
      if (requestedPath?.startsWith('/') && !requestedPath.startsWith('//')) {
        navigate(requestedPath, { state: { kycUpdated: true } });
      }
    } catch (err) {
      setError(err.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Account</p>
      <h1 className="mt-2 font-display text-3xl">Profile settings</h1>
      <form onSubmit={submit} className="certificate mt-6 max-w-2xl space-y-5 p-5 sm:p-6">
        <label className="block">
          <span className="text-sm text-ink/70">Business or display name</span>
          <input required minLength={2} maxLength={80} value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">Full legal name</span>
          <input required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">NIN or other ID number</span>
          <input required minLength={5} maxLength={40} value={form.nin} onChange={(event) => setForm({ ...form, nin: event.target.value })} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">About your business</span>
          <textarea rows={4} maxLength={500} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className="mt-1 w-full border border-line bg-input px-3 py-2 rounded-lg" />
          <span className="mt-1 block text-xs text-ink/45">{form.bio.length}/500</span>
        </label>
        <PhotoField value={form.profilePictureUrl} onChange={(profilePictureUrl) => setForm({ ...form, profilePictureUrl })} />
        <div className="border-t border-line pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Identity review</h2>
            <span className={`text-xs font-medium ${seller?.kycStatus === 'verified' ? 'text-released' : seller?.kycStatus === 'rejected' ? 'text-dispute' : 'text-seal'}`}>{seller?.kycStatus || 'pending'}</span>
          </div>
          <PhotoField value={form.idDocumentUrl} onChange={(idDocumentUrl) => setForm({ ...form, idDocumentUrl })} />
          {seller?.kycReviewNote && <p className="mt-2 text-xs text-ink/60">Review note: {seller.kycReviewNote}</p>}
          <p className="mt-2 text-xs leading-5 text-ink/50">Your ID details are stored for admin review. Escrit does not connect to a government identity-verification service.</p>
        </div>
        {error && <p role="alert" className="text-sm text-dispute">{error}</p>}
        {saved && <p role="status" className="text-sm text-released">Profile saved.</p>}
        <button disabled={saving} className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-50">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
      <ShopifyIntegration />
    </div>
  );
}