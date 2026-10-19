import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { friendlyKycError } from '../lib/kycState.js';

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
  const [form, setForm] = useState(() => profileFromSeller(seller));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getSellerProfile(seller).then(({ seller: result }) => {
      if (active && result) setForm(profileFromSeller(result));
    }).catch(() => {
      if (active && seller) setForm(profileFromSeller(seller));
    });
    return () => { active = false; };
  }, [seller?.displayName, seller?.fullName, seller?.businessName, seller?.phone, seller?.email, seller?.city]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
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
      setForm(profileFromSeller(updatedSeller));
      setSaved(true);
      return true;
    } catch (cause) {
      setError(friendlyKycError(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { form, update, save, saving, saved, error };
}
