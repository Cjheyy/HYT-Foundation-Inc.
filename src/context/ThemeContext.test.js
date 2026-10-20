import { act, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

/**
 * The theme contract.
 *
 * Three things have to hold, and each one is a user-visible failure if it does
 * not: the first paint follows the operating system, an explicit choice beats
 * the system and survives a reload, and the attribute on <html> is what the
 * stylesheet actually keys off. The screenshots in the preview cannot prove
 * any of this, because they only ever exercise a pre-seeded localStorage value.
 */

const STORAGE_KEY = 'hyt-theme';

/** jsdom has no matchMedia, so each test installs the one it needs. */
function mockSystemTheme({ dark, supportsListener = true }) {
  const listeners = [];
  const query = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (type, handler) => supportsListener && listeners.push(handler),
    removeEventListener: (type, handler) => {
      const index = listeners.indexOf(handler);
      if (index >= 0) listeners.splice(index, 1);
    }
  };
  window.matchMedia = jest.fn(() => query);
  return {
    query,
    /** Simulate the OS flipping while the app is open. */
    emit: (matches) => {
      query.matches = matches;
      act(() => listeners.forEach((handler) => handler({ matches })));
    }
  };
}

function Probe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>toggle</button>
      <button type="button" onClick={() => setTheme('dark')}>force dark</button>
      <button type="button" onClick={() => setTheme('light')}>force light</button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );

const htmlTheme = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  delete window.matchMedia;
});

describe('ThemeProvider', () => {
  test('starts dark when the operating system is dark', () => {
    mockSystemTheme({ dark: true });
    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(htmlTheme()).toBe('dark');
  });

  test('starts light when the operating system is light', () => {
    mockSystemTheme({ dark: false });
    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(htmlTheme()).toBe('light');
  });

  test('falls back to light when the browser has no matchMedia', () => {
    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  test('lets a stored choice override the system', () => {
    mockSystemTheme({ dark: true });
    window.localStorage.setItem(STORAGE_KEY, 'light');
    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(htmlTheme()).toBe('light');
  });

  test('ignores a stored value that is not a theme', () => {
    mockSystemTheme({ dark: true });
    window.localStorage.setItem(STORAGE_KEY, 'sepia');
    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  test('toggling flips the theme, repaints <html> and persists the choice', () => {
    mockSystemTheme({ dark: false });
    renderProbe();

    act(() => screen.getByText('toggle').click());

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(htmlTheme()).toBe('dark');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');

    act(() => screen.getByText('toggle').click());

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(htmlTheme()).toBe('light');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  test('setTheme persists the explicit value', () => {
    mockSystemTheme({ dark: false });
    renderProbe();

    act(() => screen.getByText('force dark').click());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(htmlTheme()).toBe('dark');
  });

  test('follows the operating system while no choice is stored', () => {
    const system = mockSystemTheme({ dark: false });
    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('light');

    system.emit(true);

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(htmlTheme()).toBe('dark');
  });

  test('stops following the operating system once a choice is stored', () => {
    const system = mockSystemTheme({ dark: false });
    renderProbe();

    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');

    system.emit(false);

    // The user said dark, so dark it stays, whatever the OS does next.
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  test('still works when storage throws', () => {
    mockSystemTheme({ dark: true });
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    renderProbe();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');

    // Persisting fails silently, but the theme still applies for the session.
    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('theme')).toHaveTextContent('light');

    getItem.mockRestore();
    setItem.mockRestore();
  });

  test('useTheme outside a provider fails loudly', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});
