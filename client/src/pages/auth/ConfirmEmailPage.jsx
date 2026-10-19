import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { AuthBrand } from '../../components/auth/AuthLayout.jsx';
import { resendVerification, verifyEmailToken } from '../../lib/auth/authApi.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function ConfirmEmailPage() {
  usePageTitle('Verify your email');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const alreadyVerified = searchParams.get('verified') === '1';
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (alreadyVerified) {
      setStatus('verified');
      return undefined;
    }
    if (!token) {
      setStatus('invalid');
      setMessage('This verification link is missing or invalid.');
      return undefined;
    }

    let cancelled = false;
    verifyEmailToken(token)
      .then(() => {
        if (!cancelled) {
          setStatus('verified');
          navigate('/confirm-email?verified=1', { replace: true });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus('invalid');
        setMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [alreadyVerified, navigate, token]);

  async function requestNewLink(event) {
    event.preventDefault();
    setResending(true);
    setResendMessage('');
    setResendSent(false);
    try {
      await resendVerification(email);
      setResendSent(true);
      setResendMessage('If an unverified account exists for this address, a new link is on its way.');
    } catch (error) {
      setResendMessage(error.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <section className="auth-form-column" aria-labelledby="verify-email-heading">
        <AuthBrand />
        <h1 id="verify-email-heading">Verify your email</h1>
        {status === 'checking' && <p className="auth-subtitle" role="status">Checking your verification link…</p>}
        {status === 'verified' && (
          <div className="auth-success" role="status">
            <h2>Your email is verified</h2>
            <p>Your Escrit account is ready. Sign in to continue.</p>
            <Link className="auth-primary" to="/sign-in">Sign in</Link>
          </div>
        )}
        {status === 'invalid' && (
          <div className="auth-success">
            <p className="auth-error" role="alert">{message}</p>
            <form onSubmit={requestNewLink}>
              <div className="auth-field">
                <label htmlFor="verification-email">Email</label>
                <input
                  id="verification-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {resendMessage && <p className={resendSent ? 'auth-helper' : 'auth-error'} role={resendSent ? 'status' : 'alert'}>{resendMessage}</p>}
              <button className="auth-primary" disabled={resending} aria-busy={resending}>
                {resending ? 'Please wait...' : 'Resend verification link'}
              </button>
            </form>
            <p className="auth-switch"><Link to="/sign-in">Back to sign in</Link></p>
          </div>
        )}
      </section>
    </AuthLayout>
  );
}
