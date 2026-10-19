import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Store } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuthContext } from '../lib/AuthContext.jsx';
import {
  LockIcon,
  BankIcon,
  LinkIcon,
  CompassIcon,
  LogoutIcon,
  AlertIcon,
  ShieldCheckIcon,
  MenuIcon,
  PromotionCreditsIcon,
  MyOrdersIcon,
  HandshakeIcon,
  DashboardIcon,
  PriceOffersIcon,
  CartIcon,
  HeartIcon,
  IdentityVerificationIcon,
  ShopIcon,
  UserIcon,
} from './icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import MobileMenu from './MobileMenu.jsx';
import PaymentModeRibbon from './PaymentModeRibbon.jsx';
import LandingFooter from './landing/LandingFooter.jsx';
import { api, getAccessToken, getRealtimeUrl } from '../lib/api.js';
import { marketplaceMocksEnabled } from '../lib/marketplaceMocks.js';

// Icon-over-label item for the signed-in desktop nav. `tourId` lets a
// walkthrough step point at this item.
function NavItem({ to, onClick, icon, label, active, badge, title, tourId }) {
  const Comp = to ? Link : 'button';
  return (
    <Comp
      to={to}
      onClick={(event) => {
        onClick?.(event);
        event.currentTarget.closest('details')?.removeAttribute('open');
      }}
      title={title}
      type={to ? undefined : 'button'}
      data-tour={tourId}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-3.5 py-2 min-w-[3.25rem] transition-colors ${
        active ? 'border border-accent/30 bg-accent/10 text-accent' : 'text-ink/65 hover:text-ink hover:bg-paper-2'
      }`}
    >
      <span className="relative flex items-center justify-center w-5 h-5">
        {icon}
        {typeof badge === 'number' ? (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
        ) : badge && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-dispute animate-pulse-soft-dispute" title={badge} />
        )}
      </span>
      <span className="text-[11px] font-medium leading-none whitespace-nowrap">{label}</span>
    </Comp>
  );
}

function ProfileMenu({ seller, onLogout, mobile = false }) {
  const closeMenu = (event) => event.currentTarget.closest('details')?.removeAttribute('open');
  return (
    <details className="relative">
      <summary
        aria-label="Open profile menu"
        title="Profile and account"
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden"
      >
        <UserIcon width={20} height={20} />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 flex w-60 flex-col gap-1 rounded-xl border border-line bg-paper p-2 shadow-card">
        <p className="truncate px-3 py-2 text-xs text-ink/50">{seller?.businessName || 'Your account'}</p>
        <Link to="/settings" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm text-ink/75 hover:bg-paper-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          Profile &amp; account settings
        </Link>
        <Link to="/dashboard/bank" onClick={closeMenu} className="rounded-lg px-3 py-2 text-sm text-ink/75 hover:bg-paper-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
          Bank and payouts
        </Link>
        {mobile && (
          <div className="flex items-center justify-between gap-2 border-y border-line px-3 py-2">
            <span className="text-sm text-ink/60">Theme</span>
            <ThemeToggle />
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            closeMenu(event);
            onLogout();
          }}
          className="rounded-lg px-3 py-2 text-left text-sm text-ink/75 hover:bg-paper-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

const TEXT_LINK = 'text-sm font-medium text-ink/70 hover:text-ink transition-colors px-2 py-2';

export default function Layout({ children }) {
  const { status, seller, hasBankAccount, logout } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sellerNavOpen, setSellerNavOpen] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const menuButtonRef = useRef(null);

  const isHome = location.pathname === '/';
  const isDashboard = location.pathname === '/dashboard';
  const isLoginPage = location.pathname === '/login';
  const isOnboarding = location.pathname === '/onboarding';
  const isAuthRefresh = location.pathname === '/sign-in' || location.pathname === '/get-started' || isOnboarding;
  const isAccountAuthPage = isLoginPage || location.pathname === '/register' || isAuthRefresh;
  const isPublicLanding =
    isHome ||
    location.pathname === '/marketplace' ||
    isLoginPage ||
    location.pathname === '/register' || isAuthRefresh;
  const isAccountPage = location.pathname === '/login' || location.pathname === '/register' || isAuthRefresh;
  const isBuyerSide = location.pathname.startsWith('/r/');
  const isAuthed = status === 'authed';
  const isChecking = status === 'checking';
  const showEmailBanner = isAuthed && !isBuyerSide && seller && seller.emailVerified === false;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Any navigation closes the menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const refreshCartCount = useCallback(() => {
    if (!isAuthed && !marketplaceMocksEnabled) {
      setCartCount(0);
      return;
    }
    api.getCart()
      .then(({ items = [] }) => setCartCount(items.reduce((sum, entry) => sum + Number(entry.quantity || 1), 0)))
      .catch(() => setCartCount(0));
  }, [isAuthed]);

  useEffect(() => {
    refreshCartCount();
    window.addEventListener('escrit:cart-updated', refreshCartCount);
    return () => window.removeEventListener('escrit:cart-updated', refreshCartCount);
  }, [refreshCartCount, location.pathname]);

  const refreshNotificationCount = useCallback(() => {
    if (!isAuthed) {
      setNotificationCount(0);
      return;
    }
    api.getNotifications()
      .then(({ unreadCount = 0 }) => setNotificationCount(unreadCount))
      .catch((error) => console.error('[notifications] Unable to refresh unread count:', error.message));
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed || isBuyerSide) {
      setNotificationCount(0);
      return undefined;
    }

    refreshNotificationCount();
    const timer = window.setInterval(refreshNotificationCount, 60000);
    const socket = io(getRealtimeUrl(), { auth: { accessToken: getAccessToken() } });
    socket.on('notification:new', () => {
      setNotificationCount((count) => count + 1);
      window.dispatchEvent(new Event('escrit:notification-received'));
    });
    socket.on('notification:read', refreshNotificationCount);
    return () => {
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, [isAuthed, isBuyerSide, refreshNotificationCount]);

  async function onLogout() {
    await logout();
    navigate('/');
  }

  const sellerItems = [
    { key: 'dashboard', to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, primary: true, active: location.pathname.startsWith('/dashboard') && location.pathname !== '/dashboard/bank' },
    { key: 'storefront', to: '/account/storefront', label: 'My storefront', Icon: Store, primary: true, active: location.pathname === '/account/storefront' },
    { key: 'marketplace', to: '/marketplace', label: 'Marketplace', Icon: ShopIcon, primary: true, active: location.pathname === '/marketplace' },
    {
      key: 'bank',
      to: '/dashboard/bank',
      label: 'Bank',
      Icon: BankIcon,
      active: location.pathname === '/dashboard/bank',
      badge: hasBankAccount ? null : 'No bank account on file',
      tourId: 'bank-nav',
    },
    { key: 'favorites', to: '/account/favorites', label: 'Saved listings', Icon: HeartIcon, active: location.pathname === '/account/favorites' },
    { key: 'orders', to: '/account/orders', label: 'My orders', Icon: MyOrdersIcon, active: location.pathname === '/account/orders' },
    { key: 'offers', to: '/account/offers', label: 'Service offers & chat', Icon: HandshakeIcon, active: location.pathname.startsWith('/account/offers') },
    { key: 'notifications', to: '/account/notifications', label: 'Notifications', Icon: Bell, active: location.pathname === '/account/notifications', badge: notificationCount || undefined },
    { key: 'price-offers', to: '/account/price-offers', label: 'Product price offers', Icon: PriceOffersIcon, active: location.pathname === '/account/price-offers' },
    { key: 'credits', to: '/account/credits', label: 'Promotion credits', Icon: PromotionCreditsIcon, active: location.pathname === '/account/credits' },
    { key: 'profile', to: '/settings', label: 'Profile settings', Icon: IdentityVerificationIcon, active: location.pathname === '/settings' },
    ...(seller?.isAdmin
      ? [
          {
            key: 'disputes',
            to: '/admin/disputes',
            label: 'Disputes',
            Icon: AlertIcon,
            active: location.pathname === '/admin/disputes',
            title: 'Admin: dispute resolution',
          },
          { key: 'complaints', to: '/admin/complaints', label: 'Buyer complaints', Icon: AlertIcon, active: location.pathname === '/admin/complaints' },
          { key: 'kyc-review', to: '/admin/kyc', label: 'KYC review', Icon: ShieldCheckIcon, active: location.pathname === '/admin/kyc' },
          { key: 'listing-review', to: '/admin/listings', label: 'Listing review', Icon: CompassIcon, active: location.pathname === '/admin/listings' },
          { key: 'category-review', to: '/admin/categories', label: 'Category requests', Icon: CompassIcon, active: location.pathname === '/admin/categories' },
          { key: 'platform-settings', to: '/admin/settings', label: 'Platform settings', Icon: LinkIcon, active: location.pathname === '/admin/settings' },
          ...(seller?.isOwner ? [{ key: 'roles', to: '/admin/users', label: 'Manage admin roles', Icon: ShieldCheckIcon, active: location.pathname === '/admin/users' }] : []),
        ]
      : []),
    { key: 'logout', onClick: onLogout, label: 'Log out', Icon: LogoutIcon },
  ];

  let menuItems;
  if (isBuyerSide) {
    menuItems = [
      isAuthed
        ? { key: 'dash', to: '/dashboard', label: 'Go to dashboard', variant: 'primary' }
        : { key: 'sell', to: '/register', label: 'Sell with Escrit', variant: 'secondary' },
    ];
  } else if (isAuthed) {
    menuItems = sellerItems;
  } else if (isPublicLanding) {
    menuItems = [
      { key: 'marketplace', to: '/marketplace', label: 'Marketplace', Icon: ShopIcon },
      { key: 'contact', to: '/#contact', label: 'Contact', Icon: LinkIcon },
      { key: 'about', to: '/#why-escrit', label: 'About us', Icon: CompassIcon },
      { key: 'login', to: '/login', label: 'Log in', variant: 'secondary' },
      { key: 'register', to: '/register', label: 'Create account', variant: 'primary' },
    ];
  } else {
    menuItems = [
      { key: 'login', to: '/login', label: 'Log in', variant: 'secondary' },
      { key: 'register', to: '/register', label: 'Create account', variant: 'primary' },
    ];
  }

  const brand = (
    <Link to={isAuthed ? '/marketplace' : '/'} className="flex items-center gap-2.5 shrink-0">
      <img src="/logo-icon.png" alt="" width={28} height={28} className="w-7 h-7" />
      <span className="font-display text-xl tracking-tight">Escrit</span>
      {!isAuthed && (
        <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-forest-800 dark:text-seal border border-line px-2.5 py-1 rounded-full">
          <LockIcon width={11} height={11} /> marketplace · escrow protected
        </span>
      )}
      {isAuthed && seller && !isBuyerSide && (
        <span className="hidden md:inline text-ink/40 text-sm truncate max-w-[9rem] border-l border-line pl-3 ml-0.5">
          {seller.businessName}
        </span>
      )}
    </Link>
  );

  return (
    <div className={`app-shell relative flex min-h-screen flex-col ${isHome ? 'is-public-home' : ''}`}>
      {!isAuthRefresh && <PaymentModeRibbon />}

      {isAuthed && !isBuyerSide && !isAuthRefresh && (
        <aside
          id="seller-navigation"
          aria-label="Seller navigation"
          aria-hidden={!sellerNavOpen}
          inert={!sellerNavOpen}
          className={`fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-line bg-paper transition-transform duration-300 ease-in-out lg:flex ${
            sellerNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Link to="/marketplace" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
            <img src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="font-display text-xl tracking-tight">Escrit</span>
          </Link>
          <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Main">
            <div className="space-y-1">
              {sellerItems.filter((item) => item.key !== 'logout').map((item) => (
                <SidebarItem key={item.key} {...item} />
              ))}
            </div>
          </nav>
          <div className="shrink-0 border-t border-line p-4">
            <div className="mb-3 flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                {(seller?.businessName || 'S').trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 truncate text-sm font-semibold">{seller?.businessName || 'Seller account'}</span>
            </div>
            <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink/65 transition-colors hover:bg-paper-2 hover:text-ink">
              <LogoutIcon width={18} height={18} /> Log out
            </button>
          </div>
        </aside>
      )}

      {!isAuthRefresh && <header className={`site-header sticky top-0 z-40 border-b border-line bg-paper px-4 py-3 sm:px-6 transition-[padding-left] duration-300 ease-in-out ${isAuthed && !isBuyerSide && sellerNavOpen ? 'lg:pl-64' : ''}`}>
        <div className="relative mx-auto flex max-w-7xl items-center justify-start gap-4">
          {isAuthed && !isBuyerSide && (
            <button
              type="button"
              onClick={() => setSellerNavOpen((open) => !open)}
              aria-label={sellerNavOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={sellerNavOpen}
              aria-controls="seller-navigation"
              title={sellerNavOpen ? 'Close navigation' : 'Open navigation'}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-paper-2 hover:text-ink lg:flex"
            >
              <img
                src="https://uxwing.com/wp-content/themes/uxwing/download/web-app-development/interface-layout-left-sidebar-icon.svg"
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className="object-contain dark:invert"
              />
            </button>
          )}

          {!isChecking && (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus md:hidden"
            >
              <img
                src="https://uxwing.com/wp-content/themes/uxwing/download/web-app-development/interface-layout-left-sidebar-icon.svg"
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className="object-contain dark:invert"
              />
            </button>
          )}

          <div className={isAuthed && !isBuyerSide && sellerNavOpen ? 'lg:hidden' : ''}>{brand}</div>
          {isAuthed && !isBuyerSide && isDashboard && (
            <span className="hidden truncate text-sm font-medium text-ink/70 lg:block">Dashboard</span>
          )}

          {isPublicLanding && !isAuthed && !isChecking && (
            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex" aria-label="Main">
              <Link to="/marketplace" className="px-1 py-2 text-xs font-medium text-ink/70 transition-colors hover:text-ink lg:text-sm">Marketplace</Link>
              <Link to="/#contact" className="px-1 py-2 text-xs font-medium text-ink/70 transition-colors hover:text-ink lg:text-sm">Contact</Link>
              <Link to="/#why-escrit" className="px-1 py-2 text-xs font-medium text-ink/70 transition-colors hover:text-ink lg:text-sm">About us</Link>
            </nav>
          )}

          {/* Desktop navigation */}
          <div className="hidden md:ml-2 md:flex md:flex-1 items-center gap-3">
            {isAuthed && !isBuyerSide && (
              <nav className="flex items-center gap-1.5 lg:hidden" aria-label="Main">
                {sellerItems.filter((item) => item.primary).map(({ key, to, onClick, Icon, label, active, badge, title, tourId }) => (
                  <NavItem
                    key={key}
                    to={to}
                    onClick={onClick}
                    icon={<Icon width={18} height={18} />}
                    label={label}
                    active={active}
                    badge={badge}
                    title={title}
                    tourId={tourId}
                  />
                ))}
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/65 hover:bg-line/40 hover:text-ink">
                    <MenuIcon width={18} height={18} /> More
                  </summary>
                  <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(70vh,32rem)] min-w-56 flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper p-2 shadow-card">
                    {sellerItems.filter((item) => !item.primary).map(({ key, to, onClick, Icon, label, active, badge, title, tourId }) => (
                      <NavItem
                        key={key}
                        to={to}
                        onClick={onClick}
                        icon={<Icon width={18} height={18} />}
                        label={label}
                        active={active}
                        badge={badge}
                        title={title}
                        tourId={tourId}
                      />
                    ))}
                  </div>
                </details>
              </nav>
            )}

            {!isAuthed && !isChecking && !isBuyerSide && (
              <nav className="ml-auto flex items-center gap-1" aria-label="Main">
                {!isPublicLanding && <Link to="/marketplace" className={TEXT_LINK}>Marketplace</Link>}
                {(!isPublicLanding || location.pathname === '/marketplace') && <NavItem to="/account/cart" icon={<CartIcon width={18} height={18} />} label="Cart" badge={cartCount || undefined} title="Shopping cart" />}
                <Link
                  to="/sign-in"
                  className={`${TEXT_LINK} ml-2 border border-line-strong rounded-md`}
                >
                  Log in
                </Link>
                <Link
                  to="/get-started"
                  className="ml-1 min-h-11 bg-accent text-accent-ink text-sm font-semibold px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
                >
                  Get started
                </Link>
              </nav>
            )}

            {isAuthed && !isBuyerSide && (
              <div className="ml-auto flex items-center gap-2">
                <Link
                  to="/account/cart"
                  aria-label={`Shopping cart, ${cartCount} items`}
                  title="Shopping cart"
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  <CartIcon width={20} height={20} />
                  {cartCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
                </Link>
                <ProfileMenu seller={seller} onLogout={onLogout} />
                <ThemeToggle />
                <Link
                  to="/account/notifications"
                  aria-label={`Notifications, ${notificationCount} unread`}
                  title="Notifications"
                  className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-paper-2 hover:text-ink ${location.pathname === '/account/notifications' ? 'text-accent' : 'text-ink/70'}`}
                >
                  <Bell width={20} height={20} />
                  {notificationCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>}
                </Link>
              </div>
            )}
          </div>

          {isAuthed && !isBuyerSide && (
            <div className="ml-auto flex items-center gap-1 md:hidden">
              <Link
                to="/account/cart"
                aria-label={`Shopping cart, ${cartCount} items`}
                title="Shopping cart"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-paper-2 hover:text-ink"
              >
                <CartIcon width={20} height={20} />
                {cartCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
              </Link>
              <ProfileMenu seller={seller} onLogout={onLogout} mobile />
              <Link
                to="/account/notifications"
                aria-label={`Notifications, ${notificationCount} unread`}
                title="Notifications"
                className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-paper-2 hover:text-ink ${location.pathname === '/account/notifications' ? 'text-accent' : 'text-ink/70'}`}
              >
                <Bell width={20} height={20} />
                {notificationCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>}
              </Link>
            </div>
          )}

          {(!isPublicLanding || location.pathname === '/marketplace') && !isChecking && !isAuthed && <Link to="/account/cart" aria-label={`Shopping cart, ${cartCount} items`} className="relative flex items-center gap-1 text-sm text-ink/70 md:hidden"><CartIcon width={20} height={20} /><span>Cart</span>{cartCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}</Link>}
          {!isChecking && isAuthed && isBuyerSide && <Link to="/account/cart" aria-label={`Shopping cart, ${cartCount} items`} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 hover:bg-line/40"><CartIcon width={20} height={20} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}</Link>}

        </div>

        {showEmailBanner && (
          <div
            className="mx-auto mt-2.5 flex max-w-7xl items-center gap-2 rounded-md border border-seal/30 bg-seal-soft px-3 py-1.5 text-xs text-seal"
          >
            <span className="flex-1">Verify your email to keep full access to your account.</span>
            <Link
              to={`/verify-email?next=${encodeURIComponent(location.pathname)}`}
              className="font-medium underline underline-offset-2 shrink-0"
            >
              Verify now
            </Link>
          </div>
        )}
      </header>}

      <MobileMenu
        open={menuOpen && !isOnboarding}
        onClose={closeMenu}
        items={menuItems}
        brand={brand}
        heading={isAuthed && !isBuyerSide ? seller?.businessName : null}
        showTheme={isAuthed}
        cartCount={cartCount}
      />

      {/* Keyed by path so each navigation replays the page transition. */}
      <main
        key={location.pathname}
        className={`relative z-10 flex-1 w-full animate-page-in transition-[margin-left,width] duration-300 ease-in-out ${
          isAuthed && !isBuyerSide && !isOnboarding && sellerNavOpen ? 'lg:ml-64 lg:w-[calc(100%-16rem)]' : ''
        } ${
          isAccountAuthPage
            ? 'max-w-none px-0 py-0 mx-0'
            : isHome
              ? ''
              : `px-4 sm:px-6 py-8 mx-auto ${location.pathname === '/account/list-product' || location.pathname === '/settings' || location.pathname === '/account/bank' || location.pathname === '/dashboard/bank' ? 'max-w-7xl' : location.pathname === '/marketplace' || location.pathname === '/dashboard' || isAccountPage ? 'max-w-6xl' : 'max-w-2xl'}`
        } ${isAuthed && !isBuyerSide && !isOnboarding ? 'pb-24 md:pb-8' : ''}`}
      >
        {children}
      </main>

      {isAuthed && !isBuyerSide && !isAuthRefresh && (
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-line bg-paper/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="mx-auto flex min-w-[20rem] max-w-lg items-end justify-around py-2">
            <BottomNavItem to="/dashboard" label="Dashboard" icon={<DashboardIcon width={20} height={20} />} />
            <BottomNavItem to="/marketplace" label="Market" icon={<CompassIcon width={20} height={20} />} />
            <BottomNavItem to="/account/storefront" label="My store" icon={<Store size={20} />} />
            <BottomNavButton onClick={() => setMenuOpen(true)} label="Profile" icon={<UserIcon width={20} height={20} />} expanded={menuOpen} />
          </div>
        </nav>
      )}

      {!isAuthRefresh && !isHome && (
        <LandingFooter
          className={`relative z-10 transition-[margin-left] duration-300 ease-in-out ${isAuthed && !isBuyerSide && sellerNavOpen ? 'lg:ml-64' : ''}`}
        />
      )}
    </div>
  );
}

function SidebarItem({ to, onClick, Icon, label, active, badge, title, tourId }) {
  const Comp = to ? Link : 'button';
  return (
    <Comp
      to={to}
      type={to ? undefined : 'button'}
      onClick={onClick}
      title={title}
      data-tour={tourId}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${
        active ? 'bg-accent/10 text-accent' : 'text-ink/65 hover:bg-paper-2 hover:text-ink'
      }`}
    >
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon width={19} height={19} />
        {typeof badge === 'number' ? (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
        ) : badge ? (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-dispute" title={badge} />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </Comp>
  );
}

function BottomNavItem({ to, label, icon, featured, badge }) {
  return (
    <Link to={to} title={label} aria-label={label} className={`flex min-w-14 flex-col items-center justify-center gap-1 text-ink/60 ${featured ? '-translate-y-1 text-ink' : ''}`}>
      <span className={`relative flex items-center justify-center rounded-full ${featured ? 'h-12 w-12 border border-accent bg-accent text-accent-ink shadow-card' : 'h-9 w-9'}`}>
        {icon}
        {typeof badge === 'number' && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

function BottomNavButton({ buttonRef, onClick, label, icon, expanded }) {
  return (
    <button ref={buttonRef} type="button" onClick={onClick} title={label} aria-label={label} aria-expanded={expanded} aria-controls="mobile-menu" className="flex min-w-14 flex-col items-center justify-center gap-1 text-ink/60">
      <span className="flex h-9 w-9 items-center justify-center">{icon}</span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
