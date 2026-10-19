import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function ForgotPassword() {
  usePageTitle('Reset your password');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Same message whether or not the email has an account, so this
      // page cannot reveal which emails are registered.
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
      console.error(err)
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl mb-2">Check your email</h1>
        <p className="text-ink/60">
          If an account exists for <span className="font-medium text-ink">{email}</span>, a reset link is on its way.
          It expires in 30 minutes.
        </p>
        <p className="text-sm text-ink/60 mt-6">
          <Link to="/sign-in" className="underline">Back to log in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="font-display text-2xl mb-1">Reset your password</h1>
      <p className="text-ink/60 mb-6">We'll email you a link to set a new one.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink/70">Email</span>
          <input type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-line px-3 py-2 bg-input focus:border-ink/50 rounded-lg" />
        </label>

        {error && <p className="text-dispute text-sm animate-fade-in-up" role="alert">{error}</p>}

        <button disabled={loading} className="w-full bg-ink text-paper py-3 font-medium disabled:opacity-50 hover:bg-ink/90 transition-colors rounded-lg">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-4">
        <Link to="/sign-in" className="underline">Back to log in</Link>
      </p>
    </div>
  );
}
