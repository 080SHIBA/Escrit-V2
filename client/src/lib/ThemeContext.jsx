import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Theme is 'light', 'dark' or 'system'. The saved choice can be "system",
// but the CSS class is always resolved to light or dark.
const STORAGE_KEY = 'escrit_theme';
const ThemeContext = createContext(null);

function getSystemPref() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyResolvedTheme(resolved) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#111522' : '#F5F6FA');
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'dark');
  const [resolved, setResolved] = useState(() => (theme === 'system' ? getSystemPref() : theme));

  useEffect(() => {
    const next = theme === 'system' ? getSystemPref() : theme;
    setResolved(next);
    applyResolvedTheme(next);
  }, [theme]);

  // Follow the operating system live when the choice is "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() {
      const next = getSystemPref();
      setResolved(next);
      applyResolvedTheme(next);
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  function setTheme(next) {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
