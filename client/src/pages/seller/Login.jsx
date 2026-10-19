import { useCallback, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import GoogleSignInButton from '../../components/GoogleSignInButton.jsx';
import AccountAside from '../../components/AccountAside.jsx';
import { EyeIcon, EyeOffIcon } from '../../components/icons.jsx';

// Optional one-click demo logins for judges. Set VITE_DEMO_BUYER_EMAIL/PASSWORD (and the SELLER pair)
// in the client env; nothing is shown when they are unset. Use throwaway demo accounts only:
// these values are public by design because they are compiled into the client bundle.
const DEMO_LOGINS = [
  { label: 'Demo buyer', email: import.meta.env.VITE_DEMO_BUYER_EMAIL, password: import.meta.env.VITE_DEMO_BUYER_PASSWORD },
  { label: 'Demo seller', email: import.meta.env.VITE_DEMO_SELLER_EMAIL, password: import.meta.env.VITE_DEMO_SELLER_PASSWORD },
].filter((demo) => demo.email && demo.password);

export default function Login() {
  usePageTitle('Log in');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthContext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function routeAfterLogin(state) {
    const requestedPath = searchParams.get('next');
    const nextPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/marketplace';
    navigate(nextPath, { state });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await api.login(form);
      await login(accessToken);
      routeAfterLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const onGoogleCredential = useCallback(
    async (idToken) => {
      setError(null);
      setLoading(true);
      try {
        const { accessToken, accountCreated } = await api.googleLogin(idToken);
        await login(accessToken);
        routeAfterLogin(accountCreated ? { accountCreated: true } : undefined);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [login, searchParams] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div
      className="relative isolate flex min-h-[calc(100svh-4rem)] w-full items-center justify-center px-4 py-8 animate-fade-in-up sm:px-6"
      style={{
        backgroundImage: "linear-gradient(90deg, rgba(5, 16, 20, 0.76), rgba(5, 16, 20, 0.48)), url('/login-market-background.jpg')",
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="grid w-full min-w-0 max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.8fr)] lg:items-center">
        <AccountAside isLogin />
        <section className="certificate min-w-0 p-6 sm:p-8">
      <h1 className="font-display text-2xl mb-6">Log in</h1>

      <GoogleSignInButton onCredential={onGoogleCredential} onError={setError} />
      <DividerOr />

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink/70">Email</span>
          <input type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg" />
        </label>
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/70">Password</span>
            <Link to="/forgot-password" className="text-xs text-ink/50 hover:text-ink underline underline-offset-2">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1">
            <input type={showPassword ? 'text' : 'password'} required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-line px-3 py-2 pr-10 bg-input focus:border-ink/50 rounded-lg" />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink transition-colors"
            >
              {showPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
            </button>
          </div>
        </label>

        {error && <p className="text-dispute text-sm animate-fade-in-up" role="alert">{error}</p>}

        {DEMO_LOGINS.length > 0 && (
          <div className="rounded-lg border border-line p-3 text-xs text-ink/60">
            <p className="mb-2 font-medium text-ink/70">Judging or exploring? Fill in a demo account:</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_LOGINS.map((demo) => (
                <button key={demo.label} type="button" onClick={() => setForm({ email: demo.email, password: demo.password })} className="rounded-lg border border-line-strong px-3 py-1.5 font-medium text-ink hover:border-ink">{demo.label}</button>
              ))}
            </div>
          </div>
        )}

        <button disabled={loading} className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg">
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-sm text-ink/60 mt-4">
        New here? <Link to={`/register${searchParams.get('next') ? `?intent=buyer&next=${encodeURIComponent(searchParams.get('next'))}` : ''}`} className="underline">Create an account</Link>
      </p>
      <p className="text-xs text-ink/50 mt-6">
        Shopping?{' '}
        <Link to="/marketplace" className="text-ink/70 underline">Browse the marketplace</Link>. An account keeps your orders and saved items together.
      </p>
        </section>
      </div>
    </div>
  );
}

function DividerOr() {
  // Only shown alongside the Google button.
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;
  return (
    <div className="flex items-center gap-3 my-5 text-xs text-ink/40">
      <div className="flex-1 h-px bg-line" />
      or
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}
