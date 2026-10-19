import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { DEFAULT_LISTING_FORM, friendlyListingError } from '../lib/listingState.js';
import { uploadListingPhoto } from '../lib/listingUploads.js';

function photoFromUrl(url, index) {
  return { id: `saved-${index}-${url}`, file: null, previewUrl: url, url, progress: 100, error: '' };
}

export function useListingDraft() {
  const [form, setForm] = useState({ ...DEFAULT_LISTING_FORM });
  const [photos, setPhotos] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = useRef(false);
  const dirtyVersion = useRef(0);
  const photosRef = useRef([]);
  const markDirty = () => {
    dirty.current = true;
    dirtyVersion.current += 1;
  };
  const photoUrls = useRef(new Set());
  function updatePhotos(updater) {
    const next = updater(photosRef.current);
    photosRef.current = next;
    setPhotos(next);
    return next;
  }

  useEffect(() => {
    let active = true;
    api.getListingDraft()
      .then(({ draft }) => {
        if (!active || !draft) return;
        setForm((current) => ({
          ...current,
          type: draft.type || current.type,
          title: draft.title || '',
          category: draft.category || '',
          description: draft.description || '',
          price: String(draft.price || ''),
          images: draft.images || [],
          allowOffers: Boolean(draft.allowOffers),
          condition: draft.condition || current.condition,
          fulfillment: draft.fulfillment || current.fulfillment,
          quantity: String(draft.quantity || 1),
          deliveryTime: draft.deliveryTime || '',
          format: draft.format || current.format,
          level: draft.level || current.level,
          duration: draft.duration || '',
        }));
        updatePhotos((draft.images || []).map(photoFromUrl));
        setDraftId(draft._id || null);
      })
      .catch((cause) => {
        if (active) setError(friendlyListingError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      photoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const saveDraft = useCallback(async () => {
    if (!dirty.current) return true;
    const version = dirtyVersion.current;
    setSaving(true);
    setError('');
    try {
      const { draft } = await api.saveListingDraft(form, draftId);
      if (draft?._id) setDraftId(draft._id);
      if (dirtyVersion.current === version) dirty.current = false;
      return true;
    } catch (cause) {
      setError(friendlyListingError(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }, [draftId, form]);

  useEffect(() => {
    if (!dirty.current || loading) return undefined;
    const timer = window.setTimeout(() => { saveDraft(); }, 850);
    return () => window.clearTimeout(timer);
  }, [form, loading, saveDraft]);

  function updateField(field, value) {
    markDirty();
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function addPhotos(fileList) {
    const selected = Array.from(fileList || []).slice(0, Math.max(0, 5 - photosRef.current.length));
    for (const file of selected) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!file.type.startsWith('image/')) {
        updatePhotos((current) => [...current, { id, file, previewUrl: '', url: '', progress: 0, error: 'Choose an image file.' }]);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        updatePhotos((current) => [...current, { id, file, previewUrl: '', url: '', progress: 0, error: 'Choose an image that is 5 MB or smaller.' }]);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      photoUrls.current.add(previewUrl);
      updatePhotos((current) => [...current, { id, file, previewUrl, url: '', progress: 0, error: '' }]);
      try {
        const url = await uploadListingPhoto(file, (progress) => {
          updatePhotos((current) => current.map((photo) => photo.id === id ? { ...photo, progress } : photo));
        });
        markDirty();
        const next = updatePhotos((current) => current.map((photo) => photo.id === id ? { ...photo, url, progress: 100 } : photo));
        setForm((values) => ({ ...values, images: next.filter((photo) => photo.url).map((photo) => photo.url) }));
      } catch (cause) {
        updatePhotos((current) => current.map((photo) => photo.id === id ? { ...photo, error: friendlyListingError(cause) } : photo));
      }
    }
  }

  function removePhoto(id) {
    updatePhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
        photoUrls.current.delete(removed.previewUrl);
      }
      const next = current.filter((photo) => photo.id !== id);
      markDirty();
      return next;
    });
    setForm((values) => ({ ...values, images: photosRef.current.filter((photo) => photo.url).map((photo) => photo.url) }));
  }

  function retryPhoto(id) {
    const photo = photos.find((item) => item.id === id);
    if (!photo?.file) return;
    updatePhotos((current) => current.map((item) => item.id === id ? { ...item, error: '', progress: 0 } : item));
    uploadListingPhoto(photo.file, (progress) => {
      updatePhotos((current) => current.map((item) => item.id === id ? { ...item, progress } : item));
    }).then((url) => {
      markDirty();
      const next = updatePhotos((current) => current.map((item) => item.id === id ? { ...item, url, progress: 100, error: '' } : item));
      setForm((values) => ({ ...values, images: next.filter((item) => item.url).map((item) => item.url) }));
    }).catch((cause) => {
      updatePhotos((current) => current.map((item) => item.id === id ? { ...item, error: friendlyListingError(cause) } : item));
    });
  }

  function clearAfterPublish() {
    photoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrls.current.clear();
    dirty.current = false;
    setForm({ ...DEFAULT_LISTING_FORM });
    photosRef.current = [];
    setPhotos([]);
    setDraftId(null);
  }

  return {
    form,
    updateField,
    photos,
    addPhotos,
    removePhoto,
    retryPhoto,
    loading,
    saving,
    error,
    saveDraft,
    clearError: () => setError(''),
    clearAfterPublish,
  };
}
