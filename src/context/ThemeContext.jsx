import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Light / dark theme.
 *
 * The default is whatever the operating system reports, so a visitor who runs
 * dark mode gets dark mode without touching anything. Once they pick a side
 * explicitly, that choice is stored and wins over the system from then on.
 *
 * The theme is expressed as `data-theme` on <html>. index.css restates its
 * colour tokens under `[data-theme="dark"]`, so no component has to know a
 * theme exists. An inline script in public/index.html applies the same
 * attribute before React mounts, which is what stops the white flash.
 */

const STORAGE_KEY = 'hyt-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const ThemeContext = createContext(null);

const systemTheme = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
};

/** The stored choice, or null when the user has never picked one. */
const storedTheme = () => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Storage can be blocked in private browsing; the system preference stands.
    return null;
  }
};

const persist = (value) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Nothing to do: the theme still applies for this session.
  }
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => storedTheme() || systemTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keep following the OS for as long as the user has not chosen explicitly.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event) => {
      if (storedTheme()) return;
      setThemeState(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    setThemeState(value);
    persist(value);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      persist(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider.');
  return context;
}
