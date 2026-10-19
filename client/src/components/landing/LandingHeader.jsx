import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import MobileMenu from '../MobileMenu.jsx';

export default function LandingHeader() {
  const { status } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthed = status === 'authed';
  const brand = (
    <Link to="/" className="landing-brand">
      <img src="/logo-icon.png" alt="" width={34} height={34} />
      <span>
        <strong>Escrit</strong>
        <small>Marketplace · Escrow</small>
      </span>
    </Link>
  );
  const menuItems = [
    { key: 'explore', to: '/#explore', label: 'Explore' },
    { key: 'escrow', to: '/#escrow', label: 'Escrow' },
    { key: 'help', to: '/#faq', label: 'Help centre' },
    ...(isAuthed
      ? [
        { key: 'create', to: '/dashboard/new', label: 'Create an escrow link', variant: 'primary' },
        { key: 'dashboard', to: '/dashboard', label: 'Dashboard', variant: 'secondary' },
      ]
      : [
        { key: 'signin', to: '/login', label: 'Sign in', variant: 'secondary' },
        { key: 'get-started', to: '/register', label: 'Get started', variant: 'primary' },
      ]),
  ];

  return (
    <>
      <header className="landing-header">
        <div className="landing-header-inner">
          {brand}
          <nav className="landing-desktop-nav" aria-label="Main navigation">
            <a href="#explore">Explore</a>
            <a href="#escrow">Escrow</a>
            <a href="#faq">Help centre</a>
          </nav>
          <div className="landing-header-actions">
            {isAuthed ? (
              <>
                <Link to="/dashboard/new" className="landing-button landing-button-primary landing-header-start">
                  <Plus size={16} aria-hidden="true" /> Create escrow link
                </Link>
                <Link to="/dashboard" className="landing-header-signin">Dashboard</Link>
              </>
            ) : (
              <>
                <Link to="/sign-in" className="landing-header-signin">Sign in</Link>
                <Link to="/get-started" className="landing-button landing-button-primary landing-header-start">Get started</Link>
              </>
            )}
            <button
              type="button"
              className="landing-menu-trigger"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Menu size={21} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        brand={brand}
        showTheme
        showThemeToggle={false}
      />
    </>
  );
}
