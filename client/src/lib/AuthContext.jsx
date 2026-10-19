import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from './api.js';

// Single source of truth for who is signed in and whether they have a
// bank account, so every page reads one seller record and one refresh
// runs per page load.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking'); // checking | authed | anon
  const [seller, setSeller] = useState(null);

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
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCKS === 'true') {
      try {
        const demoSeller = window.localStorage.getItem('escrit:auth-demo-seller');
        if (demoSeller) {
          setSeller(JSON.parse(demoSeller));
          setAccessToken('demo-auth-token');
          setStatus('authed');
          return;
        }
      } catch {
        setStatus('anon');
        return;
      }
      setStatus('anon');
      return;
    }
    api
      .refresh()
      .then(async ({ accessToken }) => {
        setAccessToken(accessToken);
        await loadSeller();
        setStatus('authed');
      })
      .catch(() => setStatus('anon'));
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
      setAccessToken(accessToken);
      if (sessionSeller) setSeller(sessionSeller);
      else await loadSeller();
      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCKS === 'true' && accessToken === 'demo-auth-token' && sessionSeller) {
        window.localStorage.setItem('escrit:auth-demo-seller', JSON.stringify(sessionSeller));
      }
      setStatus('authed');
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
