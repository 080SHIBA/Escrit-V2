import { passwordStrength } from '../../lib/auth/validation.js';

export default function StrengthMeter({ password }) {
  const { score, label } = passwordStrength(password);
  return (
    <div className="auth-strength" id="signup-strength" role="status" aria-live="polite" aria-label={`Password strength: ${label}`}>
      <div className="auth-strength-bars" aria-hidden="true">
        {[0, 1, 2, 3].map((bar) => (
          <span key={bar} className={bar < Math.min(score, 4) ? 'is-filled' : ''} />
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
}
