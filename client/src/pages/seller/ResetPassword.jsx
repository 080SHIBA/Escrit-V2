import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { EyeIcon, EyeOffIcon } from '../../components/icons.jsx';

export default function ResetPassword() {
  usePageTitle('Set a new password');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const linkLooksValid = Boolean(email && token);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword({ email, token, password });
      setDone(true);
      setTimeout(() => navigate('/sign-in'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!linkLooksValid) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl mb-2">Invalid reset link</h1>
        <p className="text-ink/60">
          This link is missing some information. Request a new one from the{' '}
          <Link to="/forgot-password" className="underline">forgot password</Link> page.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl mb-2">Password updated</h1>
        <p className="text-ink/60">Taking you to log in…</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="font-display text-2xl mb-1">Set a new password</h1>
      <p className="text-ink/60 mb-6">For {email}</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink/70">New password</span>
          <div className="relative mt-1">
            <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <button disabled={loading} className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg">
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  );
}
