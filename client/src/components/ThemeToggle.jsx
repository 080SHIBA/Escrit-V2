import { useTheme } from '../lib/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { resolved, setTheme } = useTheme();
  const nextTheme = resolved === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => setTheme(nextTheme)}
      className={`flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 transition-colors hover:bg-paper-2 hover:text-ink ${className}`}
    >
      <img
        src="https://uxwing.com/wp-content/themes/uxwing/download/arts-graphic-shapes/contrast-icon.svg"
        alt=""
        aria-hidden="true"
        width={20}
        height={20}
        className="object-contain dark:invert"
      />
    </button>
  );
}
