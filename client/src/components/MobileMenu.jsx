import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import { CartIcon, CloseIcon } from './icons.jsx';
import { KycPreviewIcon } from './admin/AdminNavIcon.jsx';

const ROW_STYLES = {
  default: 'gap-4 px-4 text-lg font-medium text-ink hover:bg-paper-2',
  active: 'gap-4 px-4 text-lg font-medium border border-accent/35 bg-accent/10 text-accent',
  primary: 'justify-center px-4 text-lg font-semibold bg-accent text-accent-ink hover:bg-accent/90',
  secondary: 'justify-center px-4 text-lg font-semibold border border-line-strong text-ink hover:border-accent',
};

function MenuRow({ item, onClose }) {
  const { to, onClick, label, Icon, badge, active, variant = 'default' } = item;
  const className = `relative flex items-center min-h-[3.5rem] rounded-xl transition-colors ${
    ROW_STYLES[active ? 'active' : variant]
  }`;
  const content = (
    <>
      {Icon && (
        <span className="relative flex items-center justify-center w-6 h-6 shrink-0">
          <Icon width={22} height={22} />
          {badge && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-dispute" title={badge} />}
        </span>
      )}
      <span>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClose} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`${className} w-full text-left`}
      onClick={() => {
        onClose();
        onClick?.();
      }}
    >
      {content}
    </button>
  );
}

// Full-screen navigation for small screens. It scrolls on its own, locks
// the page behind it, closes on Escape or navigation, and keeps keyboard
// focus inside. Rendered in <body> because the sticky header's backdrop
// blur would otherwise trap a fixed-position child inside the header.
export default function MobileMenu({ open, onClose, items, heading, brand, showTheme = true, showThemeToggle = true, cartCount = 0 }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll('a[href], button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      id="mobile-menu"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[70] flex flex-col bg-paper animate-fade-in"
    >
      <div
        className="flex items-center justify-between gap-4 px-4 min-h-[4rem] border-b border-line shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {brand}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="flex items-center justify-center w-11 h-11 -mr-2 rounded-xl text-ink hover:bg-line/40 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 pt-6"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {heading && <p className="px-4 mb-3 text-sm text-ink/50 truncate">{heading}</p>}

        <nav aria-label="Menu">
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.key} className={item.variant && item.variant !== 'default' ? 'pt-2' : ''}>
                <MenuRow item={item} onClose={onClose} />
              </li>
            ))}
          </ul>
        </nav>

        {showTheme && (
          <div className="mt-8 pt-6 px-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-ink/60">Theme</span>
            <div className="flex items-center gap-2">
              <Link to="/cart" aria-label={`Shopping cart, ${cartCount} items`} title="Shopping cart" className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 hover:bg-paper-2 hover:text-ink">
                <CartIcon width={20} height={20} />
                {cartCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
              </Link>
              <Link to="/settings" aria-label="Profile settings" title="Profile settings" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 hover:bg-paper-2 hover:text-ink">
                <KycPreviewIcon width={20} height={20} />
              </Link>
              {showThemeToggle && <ThemeToggle />}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
