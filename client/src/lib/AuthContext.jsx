import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from './api.js';
import { clearSessionHint, hasSessionHint, setSessionHint } from './sessionHint.js';
import { clearPrivateCache } from './queryCache.js';

// WHAT: tuning values for restoring a session against a server that may be
// asleep.
// WHY: a cold start can take a minute or more. Each attempt is capped so a hung
// request is abandoned and retried, and the growing delays avoid hammering a
// server that is still booting. Total patience is roughly 1.5 minutes.
const REFRESH_TIMEOUT_MS = 12000;
const RETRY_DELAYS_MS = [2000, 4000, 8000, 10000, 10000, 10000];
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const authMocksOn = () => import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCKS === 'true';

// Single source of truth for who is signed in and whether they have a
// bank account, so every page reads one seller record and one refresh
// runs per page load.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // WHAT: starting status.
  // WHY: a first-time visitor (no hint) cannot have a session, so they start as
  // 'anon' and every public page renders immediately instead of showing a
  // skeleton for as long as the server takes to answer. Only returning users
  // (hint present) and demo-mock mode start as 'checking'.
  const [status, setStatus] = useState(() => (authMocksOn() || hasSessionHint() ? 'checking' : 'anon')); // checking | authed | anon
  const [seller, setSeller] = useState(null);
  // WHAT: true while the first session restore is still running in the background.
  // WHY: a visitor with no hint may still hold a valid cookie (for example the
  // hint was cleared). Protected pages must wait for this to settle instead of
  // bouncing that user to the sign-in page, while public pages ignore it.
  const [restoring, setRestoring] = useState(true);

  const loadSeller = useCallback(async () => {
    try {
      const { seller: s } = await api.me();
      setSeller(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // Demo mode restores from localStorage and never talks to the server.
    if (authMocksOn()) {
      try {
        const demoSeller = window.localStorage.getItem('escrit:auth-demo-seller');
        if (demoSeller) {
          setSeller(JSON.parse(demoSeller));
          setAccessToken('demo-auth-token');
          setStatus('authed');
          setRestoring(false);
          return undefined;
        }
      } catch {
        // Fall through to anonymous below.
      }
      setStatus('anon');
      setRestoring(false);
      return undefined;
    }

    let cancelled = false;
    const returningUser = hasSessionHint();

    // WHAT: ask the server for a fresh access token using the refresh cookie.
    // WHY retries: a network error, timeout or 5xx means "server not ready",
    // not "you are logged out". Returning users get several attempts. A real
    // 401/403 means the session is genuinely gone, so we stop at once.
    async function restoreSession() {
      const maxAttempts = returningUser ? RETRY_DELAYS_MS.length + 1 : 1;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
        try {
          const { accessToken } = await api.refresh({ signal: controller.signal });
          window.clearTimeout(timer);
          if (cancelled) return;
          setAccessToken(accessToken);
          await loadSeller();
          if (cancelled) return;
          setSessionHint();
          setStatus('authed');
          setRestoring(false);
          return;
        } catch (error) {
          window.clearTimeout(timer);
          if (cancelled) return;
          if (error?.status === 401 || error?.status === 403) {
            clearSessionHint();
            setStatus('anon');
            setRestoring(false);
            return;
          }
          if (attempt < maxAttempts - 1) await sleep(RETRY_DELAYS_MS[attempt]);
          if (cancelled) return;
        }
      }
      // WHY keep the hint here: the server was unreachable, which says nothing
      // about the session. The next page load will try again.
      setStatus('anon');
      setRestoring(false);
    }

    restoreSession();
    return () => { cancelled = true; };
  }, [loadSeller]);

  useEffect(() => {
    if (status !== 'authed' || seller?.kycStatus !== 'pending') return undefined;
    const refreshPendingVerification = () => {
      if (document.visibilityState === 'visible') loadSeller();
    };
    const timer = window.setInterval(refreshPendingVerification, 30000);
    window.addEventListener('focus', refreshPendingVerification);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshPendingVerification);
    };
  }, [status, seller?.kycStatus, loadSeller]);

  const login = useCallback(
    async (accessToken, sessionSeller = null) => {
      // WHY wipe first: a different account may be signing in on this browser;
      // the previous person's cached orders, cart and favourites must not show.
      clearPrivateCache();
      setAccessToken(accessToken);
      if (sessionSeller) setSeller(sessionSeller);
      else await loadSeller();
      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCKS === 'true' && accessToken === 'demo-auth-token' && sessionSeller) {
        window.localStorage.setItem('escrit:auth-demo-seller', JSON.stringify(sessionSeller));
      }
      // WHY: remember this browser so the next visit restores the session patiently.
      setSessionHint();
      setStatus('authed');
      setRestoring(false);
    },
    [loadSeller]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCKS === 'true') {
        try {
          window.localStorage.removeItem('escrit:auth-demo-seller');
        } catch {
          // The in-memory session is cleared even if browser storage is unavailable.
        }
      }
      // WHY: after an explicit logout this browser has no session to restore.
      clearSessionHint();
      // WHY: private cached data belongs to the account that just left.
      clearPrivateCache();
      setAccessToken(null);
      setSeller(null);
      setStatus('anon');
    }
  }, []);

  const updateSeller = useCallback((updates) => {
    setSeller((current) => current ? { ...current, ...updates } : updates);
  }, []);

  const value = {
    status,
    restoring,
    seller,
    hasBankAccount: Boolean(seller?.bankAccount),
    login,
    logout,
    refreshSeller: loadSeller,
    updateSeller,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
