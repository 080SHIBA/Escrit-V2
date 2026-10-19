import { Link } from 'react-router-dom';

export default function ProgressHeader({ current, total, onSkip }) {
  const progress = total ? Math.round((current / total) * 100) : 0;
  return (
    <header className="onboarding-topbar">
      <Link to="/marketplace" className="onboarding-brand" aria-label="Escrit home">
        <img src="/logo-icon.png" width="32" height="32" alt="" />
        <span>Escrit</span>
      </Link>
      <div className="onboarding-progress" aria-live="polite" aria-atomic="true">
        <span>Step {current} of {total}</span>
        <div className="onboarding-progress-track" role="progressbar" aria-label="Onboarding progress" aria-valuemin="0" aria-valuemax={total} aria-valuenow={current}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      {onSkip ? <button className="onboarding-skip-setup" type="button" onClick={onSkip}>Skip setup</button> : <span />}
    </header>
  );
}
