import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { friendlyKycError } from '../lib/kycState.js';
import { useFormDraft } from './useFormDraft.js';

function profileFromSeller(seller) {
  return {
    displayName: seller?.displayName || seller?.fullName || seller?.businessName || '',
    businessName: seller?.businessName || '',
    phone: seller?.phone || '',
    email: seller?.email || '',
    city: seller?.city || '',
  };
}

export function useProfile(seller, updateSeller) {
  // WHAT: profile edits are autosaved as a draft (see useFormDraft).
  // WHY: someone halfway through editing their profile who gets interrupted should find
  // their changes when they come back, on this device or another.
  const draft = useFormDraft('profile', profileFromSeller(seller), { exclude: ['email'] }); // email is read-only, so never restored from a draft
  const form = draft.values;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    // WHY wait for draft.ready and skip when a draft was restored: the saved profile from the
    // server must not overwrite what the person was in the middle of typing.
    if (!draft.ready || draft.restored) return undefined;
    api.getSellerProfile(seller).then(({ seller: result }) => {
      if (active && result) draft.reset(profileFromSeller(result));
    }).catch(() => {
      if (active && seller) draft.reset(profileFromSeller(seller));
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ready, draft.restored, seller?.displayName, seller?.fullName, seller?.businessName, seller?.phone, seller?.email, seller?.city]);

  function update(field, value) {
    draft.setField(field, value);
    setSaved(false);
    setError('');
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const { seller: updatedSeller } = await api.updateSellerProfile({
        displayName: form.displayName.trim(),
        businessName: form.businessName.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
      });
      updateSeller(updatedSeller);
      draft.reset(profileFromSeller(updatedSeller));
      // WHY clear: the edits are now the saved profile, so the draft is obsolete.
      draft.clear({ keepValues: true });
      setSaved(true);
      return true;
    } catch (cause) {
      setError(friendlyKycError(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { form, update, save, saving, saved, error, saveState: draft.saveState };
}
