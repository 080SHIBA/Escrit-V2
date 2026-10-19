import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProgressHeader from '../components/onboarding/ProgressHeader.jsx';
import SetupSidebar from '../components/onboarding/SetupSidebar.jsx';
import {
  DoneStep,
  ONBOARDING_SCREEN_COMPONENTS,
} from '../components/onboarding/OnboardingSteps.jsx';
import { useOnboarding } from '../hooks/useOnboarding.js';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import { computeOnboardingSteps, getPrimaryGoal } from '../lib/onboardingState.js';
import { escrowTransactionPath } from '../lib/auth/returnTo.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import './onboarding.css';

function StepActions({ step, hasPrevious, canContinue, onBack, onContinue, onSkip }) {
  if (step === 'done' || step === 'return') return null;
  return (
    <div className="onboarding-actions">
      {hasPrevious && <button className="onboarding-button secondary" type="button" onClick={onBack}>Back</button>}
      <button className="onboarding-button primary" type="button" onClick={onContinue} disabled={!canContinue}>Continue</button>
      {!['welcome', 'sell1'].includes(step) && (
        <button className="onboarding-skip-step" type="button" onClick={onSkip}>Skip for now</button>
      )}
    </div>
  );
}

function goalDestination(state) {
  const primary = getPrimaryGoal(state);
  if (primary === 'sell') return { label: 'Start selling on Escrit', href: '/account/list-product' };
  if (primary === 'escrow') return { label: 'Create an escrow payment link', href: '/dashboard/new' };
  return { label: 'Explore the marketplace', href: '/marketplace' };
}

export default function OnboardingPage() {
  usePageTitle('Your account setup');
  const auth = useAuthContext();
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const [resendMessage, setResendMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const { onboarding, update, loading, saving, error, retrySave, saveNow } = useOnboarding(auth);
  const steps = useMemo(() => computeOnboardingSteps(onboarding), [onboarding]);
  const safeStep = steps.includes(onboarding.currentStep) ? onboarding.currentStep : steps[0];
  const stepIndex = Math.max(0, steps.indexOf(safeStep));
  const ActiveStep = ONBOARDING_SCREEN_COMPONENTS[safeStep] || ONBOARDING_SCREEN_COMPONENTS.welcome;
  const destination = goalDestination(onboarding);

  useEffect(() => {
    if (!loading && onboarding.completed && onboarding.flow !== 'escrow-link') {
      navigate('/marketplace', { replace: true });
    }
  }, [loading, onboarding.completed, onboarding.flow, navigate]);

  useEffect(() => {
    if (loading || safeStep !== 'escrow-preview') return undefined;
    const linkId = auth.seller?.pendingEscrowReturn?.linkId;
    const transactionId = auth.seller?.pendingEscrowReturn?.transactionId;
    if (!linkId) {
      setPreview({ state: 'invalid' });
      return undefined;
    }
    let active = true;
    setPreviewLoading(true);
    setPreviewError('');
    api.getEscrowLinkPreview(linkId, transactionId)
      .then(({ preview: result }) => {
        if (active) setPreview(result);
      })
      .catch((cause) => {
        if (active) setPreviewError(cause instanceof Error
          ? cause.message
          : 'We couldn’t load this transaction. Please try again.');
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => { active = false; };
  }, [loading, safeStep, auth.seller?.pendingEscrowReturn?.linkId, auth.seller?.pendingEscrowReturn?.transactionId, previewAttempt]);

  useEffect(() => {
    if (!loading) headingRef.current?.focus();
  }, [loading, safeStep]);

  function setStep(step) {
    update({ currentStep: step });
  }

  function moveToNext() {
    if (safeStep === 'escrow-welcome') {
      const nextRecipientStep = steps[stepIndex + 1];
      if (nextRecipientStep) setStep(nextRecipientStep);
      return;
    }
    if (safeStep === 'welcome' && onboarding.goals.length === 0) return;
    if (safeStep === 'sell1' && (!onboarding.sellerTypes.length || !onboarding.displayName.trim())) return;
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  }

  function moveBack() {
    const previous = steps[stepIndex - 1];
    if (previous) setStep(previous);
  }

  function skipStep() {
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  }

  function skipSetup() {
    setStep(steps[steps.length - 1]);
  }

  async function returnToTransaction() {
    const target = auth.seller?.pendingEscrowReturn;
    if (!target?.linkId) {
      setPreview({ state: 'invalid' });
      return;
    }
    const returnTo = escrowTransactionPath(target);
    try {
      await api.trackFunnelEvent('returned_to_transaction', target.linkId, target.transactionId || '');
    } catch (cause) {
      console.error('[funnel] could not record returned_to_transaction', cause);
    }
    try {
      await api.completeEscrowReturn();
    } catch (cause) {
      setPreviewError(cause instanceof Error
        ? cause.message
        : 'We couldn’t save your return to the transaction. Please try again.');
      return;
    }
    navigate(returnTo, { replace: true });
  }

  async function goToDashboard() {
    const target = auth.seller?.pendingEscrowReturn;
    try {
      await api.markEscrowRecipientPromptEligible();
    } catch (cause) {
      setPreviewError(cause instanceof Error
        ? cause.message
        : 'We couldn’t save your setup. Please try again.');
      return;
    }
    navigate('/dashboard', { replace: true, state: { dismissedEscrowReturn: true, linkId: target?.linkId } });
  }

  async function finish(to = destination.href) {
    const completed = { ...onboarding, completed: true, currentStep: safeStep };
    update({ completed: true, currentStep: safeStep });
    await saveNow(completed);
    navigate(to, { replace: true });
  }

  async function resendVerification() {
    setResendMessage('');
    try {
      const result = await api.resendVerification(auth.seller?.email || '');
      setResendMessage(result.mock
        ? 'Mock mode is on; no verification email was sent.'
        : 'We sent a verification link to your email.');
    } catch (cause) {
      setResendMessage(cause instanceof Error ? cause.message : 'We couldn’t resend the verification email. Try again later.');
    }
  }

  const name = auth.seller?.fullName || auth.seller?.displayName || auth.seller?.businessName || '';

  if (loading) {
    return <div className="onboarding-loading" role="status" aria-live="polite">Loading your setup…</div>;
  }

  return (
    <div className="onboarding-page">
      <ProgressHeader
        current={stepIndex + 1}
        total={steps.length}
        onSkip={onboarding.flow === 'escrow-link' ? undefined : skipSetup}
      />
      <div className="onboarding-content">
        <section className="onboarding-card" aria-describedby="onboarding-card-description">
          <p id="onboarding-card-description" className="sr-only">
            {onboarding.flow === 'escrow-link'
              ? 'Return to the escrow transaction you opened. No terms are accepted or payment made during this setup.'
              : 'Personalize your Escrit account. Every choice can be changed later.'}
          </p>
          {error && (
            <div className="onboarding-save-error" role="status">
              <span>{error}</span>
              <button type="button" onClick={retrySave} disabled={saving}>Try again</button>
            </div>
          )}
          {safeStep === 'escrow-welcome' ? (
            <ActiveStep
              headingRef={headingRef}
              name={name}
              onContinue={moveToNext}
            />
          ) : safeStep === 'escrow-preview' ? (
            <ActiveStep
              headingRef={headingRef}
              preview={preview}
              loading={previewLoading}
              error={previewError}
              onRetry={() => setPreviewAttempt((attempt) => attempt + 1)}
              onReview={returnToTransaction}
              onDashboard={goToDashboard}
            />
          ) : safeStep === 'done' ? (
            <>
              <DoneStep
                headingRef={headingRef}
                state={onboarding}
                name={name}
                email={auth.seller?.email || ''}
                onResend={resendVerification}
                resendMessage={resendMessage}
              />
              <div className="onboarding-actions onboarding-finish-actions">
                <button className="onboarding-button primary" type="button" onClick={() => finish(destination.href)}>
                  {destination.label}
                </button>
                <button className="onboarding-button secondary" type="button" onClick={() => finish('/dashboard')}>
                  Go to dashboard
                </button>
              </div>
            </>
          ) : (
            <>
              <ActiveStep headingRef={headingRef} state={onboarding} update={update} name={name} />
              <StepActions
                step={safeStep}
                hasPrevious={stepIndex > 0}
                canContinue={safeStep === 'welcome'
                  ? onboarding.goals.length > 0
                  : safeStep !== 'sell1' || (onboarding.sellerTypes.length > 0 && Boolean(onboarding.displayName.trim()))}
                onBack={moveBack}
                onContinue={moveToNext}
                onSkip={skipStep}
              />
            </>
          )}
          <p className="onboarding-saving" aria-live="polite">{saving ? 'Saving your choices…' : 'Your choices save automatically.'}</p>
        </section>
        <SetupSidebar onboarding={onboarding} seller={auth.seller} />
      </div>
      {onboarding.flow !== 'escrow-link' && (
        <footer className="onboarding-footer">
          <Link to="/marketplace">You can change your setup any time</Link>
        </footer>
      )}
    </div>
  );
}
