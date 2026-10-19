import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { AuthBackLink, AuthBrand } from '../../components/auth/AuthLayout.jsx';
import GoogleButton from '../../components/auth/GoogleButton.jsx';
import PasswordField from '../../components/auth/PasswordField.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { validateSignIn } from '../../lib/auth/validation.js';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { escrowOnboardingDestination, getEscrowReturnTo } from '../../lib/auth/returnTo.js';

export default function SignInPage() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getEscrowReturnTo(searchParams);
  const auth = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    document.getElementById('signin-email')?.focus();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateSignIn(form);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      document.getElementById(nextErrors.email ? 'signin-email' : 'signin-password')?.focus();
      return;
    }

    setMessage('');
    setCanResend(false);
    setResendMessage('');
    try {
      const result = await auth.signIn({ ...form, email: form.email.trim(), ...(returnTo ? { returnTo } : {}) });
      navigate(escrowOnboardingDestination(result), { replace: true });
    } catch (error) {
      setMessage(error.message);
      setCanResend(error.status === 403);
    }
  }

  async function continueWithGoogle(idToken) {
    try {
      const result = await auth.google(idToken, returnTo);
      navigate(escrowOnboardingDestination(result), { replace: true });
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resendVerification() {
    setResendMessage('');
    try {
      await auth.resendVerification(form.email);
      setResendMessage('If this email needs verification, a new link is on its way.');
    } catch (error) {
      setResendMessage(error.message);
    }
  }

  return (
    <AuthLayout videoSrc="/videos/escrit-auth.mp4">
      <section className="auth-form-column" aria-labelledby="signin-heading">
        <AuthBackLink />
        <AuthBrand />
        <h1 id="signin-heading">Sign in</h1>
        <GoogleButton loading={auth.loading} onClick={continueWithGoogle} onError={setMessage} />
        <div className="auth-divider"><span>or</span></div>
        <form onSubmit={submit} noValidate>
          <div className="auth-field">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'signin-email-error' : undefined}
              required
            />
            {errors.email && <p id="signin-email-error" className="auth-error" aria-live="polite">{errors.email}</p>}
          </div>
          <PasswordField
            id="signin-password"
            value={form.password}
            onChange={(password) => updateField('password', password)}
            autoComplete="current-password"
            error={errors.password}
          />
          <div className="auth-forgot"><Link to="/forgot-password">Forgot password?</Link></div>
          {message && <p className="auth-error" role="alert">{message}</p>}
          {canResend && (
            <div className="auth-resend">
              <button type="button" className="auth-back" onClick={resendVerification} disabled={auth.loading}>
                {auth.loading ? 'Please wait...' : 'Resend verification email'}
              </button>
              {resendMessage && <p className="auth-helper" role="status">{resendMessage}</p>}
            </div>
          )}
          <button className="auth-primary" disabled={auth.loading} aria-busy={auth.loading}>
            {auth.loading ? 'Please wait...' : 'Sign in'}
          </button>
        </form>
        <p className="auth-terms">
          By continuing, you agree to Escrit&apos;s <Link to="/terms">Terms of Service</Link> and{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
        <p className="auth-switch">New to Escrit? <Link to="/get-started">Get started</Link></p>
      </section>
    </AuthLayout>
  );
}
