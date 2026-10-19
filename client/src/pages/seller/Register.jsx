import { useCallback, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';
import GoogleSignInButton from '../../components/GoogleSignInButton.jsx';
import AccountAside from '../../components/AccountAside.jsx';
import { EyeIcon, EyeOffIcon } from '../../components/icons.jsx';

export default function Register() {
  usePageTitle('Create your account');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthContext();
  const [form, setForm] = useState({ email: '', password: '', businessName: '', fullName: '', nin: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const isBuyerFlow = searchParams.get('intent') === 'buyer';

  function routeAfterRegistration(state) {
    const requestedPath = searchParams.get('next');
    const nextPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/marketplace';
    navigate(nextPath, { state });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await api.register({
        ...form,
        businessName: isBuyerFlow ? (form.businessName || 'Buyer account') : form.businessName,
      });
      await login(accessToken);
      routeAfterRegistration({ accountCreated: true });
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
        routeAfterRegistration(accountCreated ? { accountCreated: true } : undefined);
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
        backgroundImage: "linear-gradient(90deg, rgba(5, 16, 20, 0.76), rgba(5, 16, 20, 0.48)), url('/register-market-background.jpg')",
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="grid w-full min-w-0 max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.8fr)] lg:items-center">
        <AccountAside isRegister />
        <section className="certificate min-w-0 p-6 sm:p-8">
      <h1 className="font-display text-2xl mb-1">{isBuyerFlow ? 'Create your buyer account' : 'Join the Escrit marketplace'}</h1>
      <p className="text-ink/60 mb-6">{isBuyerFlow ? 'Keep your cart, orders, and saved listings together.' : 'Shop or sell across products, courses, and services.'}</p>

      {!isBuyerFlow && <p className="mb-6 border-l-2 border-seal pl-3 text-xs leading-5 text-ink/60">
        You can browse and buy as soon as you join. Add payout details only when you are ready to sell.
      </p>}

      <GoogleSignInButton onCredential={onGoogleCredential} onError={setError} />
      <DividerOr />

      <form onSubmit={onSubmit} className="space-y-4">
        {!isBuyerFlow && <Field label="Business name" value={form.businessName}
          onChange={(v) => setForm({ ...form, businessName: v })} required />
        }
        <Field label="Full legal name" value={form.fullName}
          onChange={(v) => setForm({ ...form, fullName: v })} required minLength={2} maxLength={120} autoComplete="name" />
        <Field label="NIN or other ID number" value={form.nin}
          onChange={(v) => setForm({ ...form, nin: v })} required minLength={5} maxLength={40} autoComplete="off" />
        <Field label="Email" type="email" value={form.email}
          onChange={(v) => setForm({ ...form, email: v })} required />
        <PasswordField label="Password" value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          show={showPassword} onToggleShow={() => setShowPassword((s) => !s)}
          required minLength={8} />

        {error && <p className="text-dispute text-sm animate-fade-in-up" role="alert">{error}</p>}

        <button disabled={loading} className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-4">
        Already have an account? <Link to="/sign-in" className="underline">Log in</Link>
      </p>
        </section>
      </div>
    </div>
  );
}

function DividerOr() {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;
  return (
    <div className="flex items-center gap-3 my-5 text-xs text-ink/40">
      <div className="flex-1 h-px bg-line" />
      or
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <label className="block">
      <span className="text-sm text-ink/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg"
        {...rest}
      />
    </label>
  );
}

function PasswordField({ label, value, onChange, show, onToggleShow, ...rest }) {
  return (
    <label className="block">
      <span className="text-sm text-ink/70">{label}</span>
      <div className="relative mt-1">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-line px-3 py-2 pr-10 bg-input focus:border-ink/50 rounded-lg"
          {...rest}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink transition-colors"
        >
          {show ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
        </button>
      </div>
    </label>
  );
}
