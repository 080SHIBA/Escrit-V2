import { useState } from 'react';

export default function PasswordField({
  label = 'Password',
  value,
  onChange,
  autoComplete,
  error,
  id = 'password',
  describedBy,
  children,
}) {
  const [shown, setShown] = useState(false);
  const describedByIds = [describedBy, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-wrap">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedByIds}
          required
        />
        <button
          type="button"
          className="auth-show"
          onClick={() => setShown((current) => !current)}
          aria-label={shown ? 'Hide password' : 'Show password'}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {children}
      {error && <p id={`${id}-error`} className="auth-error" aria-live="polite">{error}</p>}
    </div>
  );
}
