import MediaPanel from './MediaPanel.jsx';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './auth.css';

export default function AuthLayout({ children, videoSrc = '/videos/escrit-auth-optimized.mp4' }) {
  return (
    <div className="auth-layout">
      <main className="auth-main">{children}</main>
      <MediaPanel videoSrc={videoSrc} />
    </div>
  );
}

export function AuthBrand() {
  return (
    <div className="auth-brand" aria-label="Escrit">
      <img className="auth-logo" src="/logo-icon.png" alt="Escrit" width="56" height="56" />
    </div>
  );
}

export function AuthBackLink() {
  return (
    <Link className="auth-back-home" to="/">
      <ArrowLeft size={16} aria-hidden="true" />
      Go back
    </Link>
  );
}
