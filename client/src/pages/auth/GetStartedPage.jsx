import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { AuthBackLink, AuthBrand } from '../../components/auth/AuthLayout.jsx';
import GoogleButton from '../../components/auth/GoogleButton.jsx';
import PasswordField from '../../components/auth/PasswordField.jsx';
import StrengthMeter from '../../components/auth/StrengthMeter.jsx';
import IntentPills from '../../components/auth/IntentPills.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { validateSignUp } from '../../lib/auth/validation.js';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { escrowOnboardingDestination, getEscrowReturnTo } from '../../lib/auth/returnTo.js';

export default function GetStartedPage() {
  usePageTitle('Get started');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getEscrowReturnTo(searchParams);
  const auth = useAuth();
  const emailRef = useRef(null);
  const intentRef = useRef(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', fullName: '', password: '' });
  const [intents, setIntents] = useState(['Buy']);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (step === 1) emailRef.current?.focus();
    else intentRef.current?.focus();
  }, [step]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setMessage('');
  }

  function continueStep(event) {
    event.preventDefault();
    const nextErrors = validateSignUp(form);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      const firstInvalidField = nextErrors.email ? 'signup-email' : nextErrors.fullName ? 'signup-name' : 'signup-password';
      document.getElementById(firstInvalidField)?.focus();
      return;
    }

    setMessage('');
    if (returnTo) {
      createAccount(['Buy']);
      return;
    }
    setStep(2);
  }

  async function createAccount(selectedIntents = intents) {
    setMessage('');
    setCanResend(false);
    try {
      const result = await auth.signUp({
        ...form,
        email: form.email.trim(),
        intents: selectedIntents,
        ...(returnTo ? { returnTo } : {}),
      });
      navigate(escrowOnboardingDestination(result), { replace: true, state: { newUser: true } });
    } catch (error) {
      setMessage(error.message);
      setCanResend(error.status === 502);
    }
  }

  async function continueWithGoogle(idToken) {
    try {
      const result = await auth.google(idToken, returnTo);
      navigate(escrowOnboardingDestination(result), { replace: true, state: { newUser: Boolean(result.accountCreated) } });
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resendVerification() {
    setResendMessage('');
    try {
      await auth.resendVerification(form.email);
      setCanResend(false);
      setResendMessage('Verification email sent. Verify your email, then sign in to continue.');
    } catch (error) {
      setResendMessage(error.message);
    }
  }

  return (
    <AuthLayout>
      <section className="auth-form-column auth-start" aria-labelledby="signup-heading">
        <AuthBackLink />
        <AuthBrand />
        <h1 id="signup-heading">Create your account</h1>
        <p className="auth-subtitle">One account to buy, sell and manage escrow.</p>
        {(
          <>
            {step === 1 ? (
              <>
                <GoogleButton loading={auth.loading} onClick={continueWithGoogle} onError={setMessage} />
                <div className="auth-divider"><span>or</span></div>
                <form onSubmit={continueStep} noValidate>
                  <div className="auth-field">
                    <label htmlFor="signup-email">Email</label>
                    <input
                      ref={emailRef}
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'signup-email-error' : undefined}
                      required
                    />
                    {errors.email && <p id="signup-email-error" className="auth-error" aria-live="polite">{errors.email}</p>}
                  </div>
                  <div className="auth-field">
                    <label htmlFor="signup-name">Full name, as on your ID</label>
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(event) => updateField('fullName', event.target.value)}
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={`signup-name-help${errors.fullName ? ' signup-name-error' : ''}`}
                      required
                    />
                    <small id="signup-name-help" className="auth-helper">
                      Use your name exactly as it appears on your ID. You will need it to get paid.
                    </small>
                    {errors.fullName && <p id="signup-name-error" className="auth-error" aria-live="polite">{errors.fullName}</p>}
                  </div>
                  <PasswordField
                    id="signup-password"
                    value={form.password}
                    onChange={(password) => updateField('password', password)}
                    autoComplete="new-password"
                    error={errors.password}
                    describedBy="signup-strength"
                  >
                    <StrengthMeter password={form.password} />
                  </PasswordField>
                  {message && <p className="auth-error" role="alert">{message}</p>}
                  <button className="auth-primary" disabled={auth.loading} aria-busy={auth.loading}>
                    {auth.loading ? 'Please wait...' : 'Create account'}
                  </button>
                </form>
              </>
            ) : (
              <div className="auth-step">
                <p className="auth-step-title">What would you like to do?</p>
                <IntentPills value={intents} onChange={setIntents} firstButtonRef={intentRef} />
                {message && <p className="auth-error" role="alert">{message}</p>}
                {canResend && (
                  <div className="auth-resend">
                    <button type="button" className="auth-back" onClick={resendVerification} disabled={auth.loading}>
                      {auth.loading ? 'Please wait...' : 'Resend verification email'}
                    </button>
                    {resendMessage && <p className="auth-error" role="alert">{resendMessage}</p>}
                  </div>
                )}
                <button
                  className="auth-primary"
                  onClick={() => createAccount()}
                  disabled={auth.loading}
                  aria-busy={auth.loading}
                >
                  {auth.loading ? 'Please wait...' : 'Continue'}
                </button>
                <button className="auth-back" onClick={() => setStep(1)}>Back</button>
              </div>
            )}
          </>
        )}
        <p className="auth-switch">Already have an account? <Link to="/sign-in">Sign in</Link></p>
      </section>
    </AuthLayout>
  );
}
