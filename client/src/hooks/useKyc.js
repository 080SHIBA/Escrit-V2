import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { friendlyKycError } from '../lib/kycState.js';

export function useKyc({ updateSeller }) {
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { kyc: result } = await api.getKyc();
      setKyc(result);
      updateSeller({ kycStatus: result.status, kycReviewNote: result.reviewReason || '' });
    } catch (cause) {
      setError(friendlyKycError(cause));
    } finally {
      setLoading(false);
    }
  }, [updateSeller]);

  useEffect(() => { load(); }, [load, attempt]);

  useEffect(() => {
    if (kyc?.status !== 'pending') return undefined;
    const timer = window.setInterval(async () => {
      try {
        const { kyc: latest } = await api.getKyc();
        setKyc(latest);
        updateSeller({ kycStatus: latest.status, kycReviewNote: latest.reviewReason || '' });
      } catch {
        // The main page retains its last successful status and can be retried manually.
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [kyc?.status, updateSeller]);

  const submit = useCallback(async (formData) => {
    setError('');
    setProgress(0);
    try {
      const { kyc: result } = await api.submitKyc(formData, setProgress);
      setKyc(result);
      updateSeller({ kycStatus: result.status, kycReviewNote: result.reviewReason || '' });
      setToast('Documents submitted for review.');
      window.setTimeout(() => setToast(''), 3500);
      return true;
    } catch (cause) {
      setError(friendlyKycError(cause));
      return false;
    } finally {
      setProgress(null);
    }
  }, [updateSeller]);

  const simulateApproval = useCallback(async () => {
    setError('');
    try {
      const { kyc: result } = await api.simulateKycApproval();
      setKyc(result);
      updateSeller({ kycStatus: result.status, kycReviewNote: '' });
    } catch (cause) {
      setError(friendlyKycError(cause));
    }
  }, [updateSeller]);

  const clearError = useCallback(() => setError(''), []);

  return {
    kyc,
    loading,
    error,
    progress,
    toast,
    retry: () => setAttempt((current) => current + 1),
    submit,
    simulateApproval,
    clearError,
  };
}
