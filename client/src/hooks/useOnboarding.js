import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { createInitialOnboarding } from '../lib/onboardingState.js';

/**
 * @typedef {import('../lib/onboardingState.js').OnboardingState} OnboardingState
 * @typedef {{ seller?: { email?: string, fullName?: string, displayName?: string, businessName?: string, accountIntents?: string[], onboarding?: Partial<OnboardingState> } | null }} AuthLike
 */

/**
 * @param {AuthLike} auth
 * @returns {{
 *   onboarding: OnboardingState,
 *   update: (patch: Partial<OnboardingState>) => void,
 *   loading: boolean,
 *   saving: boolean,
 *   error: string,
 *   retrySave: () => Promise<void>,
 * }}
 */
export function useOnboarding({ seller }) {
  const [onboarding, setOnboarding] = useState(() => createInitialOnboarding());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const timer = useRef(null);
  const account = seller?.email || 'demo';

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getOnboarding(account)
      .then(({ onboarding: saved }) => {
        if (!active) return;
        const goals = seller?.accountIntents?.map((intent) => intent === 'Escrow links' ? 'Escrow' : intent) || [];
        let localDraft = null;
        try {
          const draft = window.localStorage.getItem(`escrit:onboarding:draft:${account.toLowerCase()}`);
          localDraft = draft ? JSON.parse(draft) : null;
        } catch {
          setError('We couldn’t restore your saved setup from this device.');
        }
        const initial = createInitialOnboarding({
          goals: goals.length ? goals : ['Buy'],
          displayName: seller?.displayName || seller?.fullName || seller?.businessName || '',
          ...(saved || seller?.onboarding || localDraft || {}),
          goals: saved?.goals?.length
            ? saved.goals
            : seller?.onboarding?.goals?.length
              ? seller.onboarding.goals
              : localDraft?.goals?.length
                ? localDraft.goals
                : goals.length ? goals : ['Buy'],
          displayName: saved?.displayName
            || seller?.onboarding?.displayName
            || localDraft?.displayName
            || seller?.displayName
            || seller?.fullName
            || seller?.businessName
            || '',
          flow: seller?.pendingEscrowReturn ? 'escrow-link' : saved?.flow || seller?.onboarding?.flow || localDraft?.flow || 'new-user',
          currentStep: seller?.pendingEscrowReturn
            ? ['escrow-welcome', 'escrow-preview'].includes(saved?.currentStep || seller?.onboarding?.currentStep)
              ? saved?.currentStep || seller?.onboarding?.currentStep
              : 'escrow-welcome'
            : saved?.currentStep || seller?.onboarding?.currentStep || localDraft?.currentStep || 'welcome',
          returnTo: seller?.pendingEscrowReturn?.transactionId
            ? `/r/${seller.pendingEscrowReturn.linkId}/t/${seller.pendingEscrowReturn.transactionId}`
            : seller?.pendingEscrowReturn?.linkId
              ? `/r/${seller.pendingEscrowReturn.linkId}`
              : '',
        });
        setOnboarding(initial);
        if (saved || seller?.onboarding || !localDraft) setError('');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'We couldn’t load your setup. Please try again.');
        setOnboarding(createInitialOnboarding({
          goals: seller?.accountIntents?.map((intent) => intent === 'Escrow links' ? 'Escrow' : intent) || ['Buy'],
          displayName: seller?.displayName || seller?.fullName || seller?.businessName || '',
          flow: seller?.pendingEscrowReturn ? 'escrow-link' : 'new-user',
          currentStep: seller?.pendingEscrowReturn ? 'escrow-welcome' : 'welcome',
          returnTo: seller?.pendingEscrowReturn?.transactionId
            ? `/r/${seller.pendingEscrowReturn.linkId}/t/${seller.pendingEscrowReturn.transactionId}`
            : seller?.pendingEscrowReturn?.linkId ? `/r/${seller.pendingEscrowReturn.linkId}` : '',
        }));
      })
      .finally(() => {
        if (active) {
          loadedRef.current = true;
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [account]); // load when the authenticated account changes

  const persist = useCallback((snapshot) => {
    setSaving(true);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => api.saveOnboarding(snapshot, account))
      .then(() => setError(''))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'We couldn’t save your setup.'))
      .finally(() => setSaving(false));
    return saveQueue.current;
  }, [account]);

  const update = useCallback((patch) => {
    setOnboarding((current) => {
      const next = {
        ...current,
        ...patch,
        verificationIntent: {
          ...current.verificationIntent,
          ...(patch.verificationIntent || {}),
        },
      };
      try {
        window.localStorage.setItem(`escrit:onboarding:draft:${account.toLowerCase()}`, JSON.stringify(next));
      } catch {
        setError('Your browser couldn’t save a local backup. Your account can still be used.');
      }
      if (loadedRef.current) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => persist(next), 300);
      }
      return next;
    });
  }, [account, persist]);

  const saveNow = useCallback(async (snapshot) => {
    window.clearTimeout(timer.current);
    await persist(snapshot);
  }, [persist]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { onboarding, update, loading, saving, error, retrySave: () => saveNow(onboarding), saveNow };
}
