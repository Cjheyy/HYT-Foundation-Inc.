import { useTheme } from '../context/ThemeContext';
import { Icon } from './icons';
import './ThemeToggle.css';

/**
 * The theme switch.
 *
 * One button that reports its state rather than two competing buttons: the
 * label always describes the theme you are currently in, and the icon is the
 * one you would move to. `aria-pressed` keeps it honest for screen readers,
 * which otherwise just hear "switch to dark" with no idea which is active.
 */
export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={nextLabel}
      title={nextLabel}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
