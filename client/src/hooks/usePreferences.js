import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { DEFAULT_TRANSACTION_PREFERENCES } from '../lib/transactionPreferences.js';

export function usePreferences() {
  const [preferences, setPreferences] = useState({ ...DEFAULT_TRANSACTION_PREFERENCES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const preferencesRef = useRef(preferences);
  const saveQueueRef = useRef(Promise.resolve());
  const saveVersionRef = useRef(0);

  useEffect(() => {
    let active = true;
    api.getTransactionPreferences()
      .then(({ preferences: result }) => {
        if (!active) return;
        preferencesRef.current = { ...DEFAULT_TRANSACTION_PREFERENCES, ...result };
        setPreferences(preferencesRef.current);
      })
      .catch((cause) => {
        if (active) setError(cause.message || 'Unable to load transaction preferences.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const updatePreferences = useCallback((patch) => {
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    setSaving(true);
    setSaved(false);
    setError('');
    const version = ++saveVersionRef.current;

    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => api.saveTransactionPreferences(next))
      .then(({ preferences: result }) => {
        if (version !== saveVersionRef.current) return;
        preferencesRef.current = { ...DEFAULT_TRANSACTION_PREFERENCES, ...result };
        setPreferences(preferencesRef.current);
        setSaved(true);
      })
      .catch((cause) => {
        if (version === saveVersionRef.current) setError(cause.message || 'Unable to save transaction preferences.');
      })
      .finally(() => {
        if (version === saveVersionRef.current) setSaving(false);
      });
  }, []);

  return { preferences, loading, saving, saved, error, updatePreferences };
}
