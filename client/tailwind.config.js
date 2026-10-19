// Design tokens for Escrit.
//
// v3: one design system, two modes. Every color below is a CSS
// variable (see styles/tokens.css) so the SAME token names — bg-paper,
// text-ink, bg-seal, .certificate, etc — resolve to the light-mode
// values by default and the dark ("vault") values under an
// `html.dark` class. No component needs its own light/dark branch for
// color; ThemeContext just toggles that one class (or follows system
// preference). The handful of places that differ in more than color
// (glass blur vs flat shadow, glow box-shadows) use `dark:` variants
// directly, kept in tokens.css.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // A named breakpoint below Tailwind's default smallest ("sm" =
      // 640px) for the handful of things (the wordmark text next to
      // the logo, nav item padding) that need one more step for
      // phones in the ~360–420px range. Any `xs:` variant used
      // WITHOUT this actually being defined silently fails to compile
      // at all — Tailwind just drops the class — which is what had
      // quietly made the nav labels invisible at every screen size
      // before this file existed; keep this in sync with any future
      // `xs:` usage.
      screens: {
        xs: '420px',
      },
      colors: {
        forest: {
          50: 'oklch(var(--color-forest-50) / <alpha-value>)',
          100: 'oklch(var(--color-forest-100) / <alpha-value>)',
          700: 'oklch(var(--color-forest-700) / <alpha-value>)',
          800: 'oklch(var(--color-forest-800) / <alpha-value>)',
          900: 'oklch(var(--color-forest-900) / <alpha-value>)',
          950: 'oklch(var(--color-forest-950) / <alpha-value>)',
        },
        ochre: 'oklch(var(--color-ochre) / <alpha-value>)',
        ink: 'oklch(var(--color-ink) / <alpha-value>)',
        paper: 'oklch(var(--color-paper) / <alpha-value>)',
        'paper-2': 'oklch(var(--color-paper-2) / <alpha-value>)',
        surface: 'oklch(var(--color-surface) / <alpha-value>)',
        input: 'oklch(var(--color-input) / <alpha-value>)',
        line: 'oklch(var(--color-line) / <alpha-value>)',
        'line-strong': 'oklch(var(--color-line-strong) / <alpha-value>)',
        accent: 'oklch(var(--color-accent) / <alpha-value>)',
        'accent-ink': 'oklch(var(--color-accent-ink) / <alpha-value>)',
        seal: 'oklch(var(--color-seal) / <alpha-value>)',
        'seal-soft': 'oklch(var(--color-seal) / 0.14)',
        released: 'oklch(var(--color-released) / <alpha-value>)',
        'released-soft': 'oklch(var(--color-released) / 0.14)',
        dispute: 'oklch(var(--color-dispute) / <alpha-value>)',
        'dispute-soft': 'oklch(var(--color-dispute) / 0.14)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-md': 'var(--shadow-card-md)',
        'card-lg': 'var(--shadow-card-lg)',
      },
      keyframes: {
        carouselFadeIn: {
          from: { opacity: '0', transform: 'scale(1.012)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        pulseSoft: {
          '0%, 100%': { boxShadow: '0 0 0 0 oklch(var(--color-seal) / 0.35)' },
          '50%': { boxShadow: '0 0 0 6px oklch(var(--color-seal) / 0)' },
        },
        pulseSoftDispute: {
          '0%, 100%': { boxShadow: '0 0 0 0 oklch(var(--color-dispute) / 0.35)' },
          '50%': { boxShadow: '0 0 0 6px oklch(var(--color-dispute) / 0)' },
        },
        drawCheck: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Whole-page transition, applied by Layout.jsx to a container
        // keyed on the route so it replays on every navigation — a
        // measured fade + rise + settle, not a bouncy or flashy
        // effect, to read as deliberate and professional rather than
        // playful (this is used on every single page, including
        // payout and dispute screens).
        //
        // IMPORTANT: the animation below uses `backwards`, NOT `both`
        // (both = backwards + forwards). `forwards` would leave the
        // 100% keyframe's `transform: translateY(0) scale(1)` applied
        // to <main> forever after the animation ends — visually a
        // no-op, but a *non-"none"* computed transform value, which
        // per spec makes that element a containing block for any
        // position:fixed descendant. Any modal/tooltip/spotlight
        // rendered inside <main> (e.g. SpotlightTour, before it was
        // switched to a document.body portal) would then be positioned
        // relative to <main>'s box instead of the real viewport —
        // exactly the "highlights the wrong spot" bug this caused.
        // `backwards` still applies the 0% frame during the (zero-length)
        // delay, so there's no visual difference, it just stops holding
        // the transform after the animation completes.
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.995)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Ambient background marks: drift a short distance, fade in
        // then fizzle out, never impeding page content (low opacity,
        // pointer-events: none, see AmbientBackground.jsx).
        driftFizzle: {
          '0%': { opacity: '0', transform: 'translate(0, 0) scale(0.9) rotate(0deg)' },
          '12%': { opacity: 'var(--drift-max-opacity, 0.06)' },
          '85%': { opacity: 'var(--drift-max-opacity, 0.06)' },
          '100%': { opacity: '0', transform: 'translate(var(--drift-x, 40px), var(--drift-y, -60px)) scale(1.05) rotate(6deg)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease-out both',
        'carousel-fade-in': 'carouselFadeIn 0.6s ease-out both',
        'fade-in': 'fadeIn 0.3s ease-out both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.2s ease-in-out infinite',
        'pulse-soft-dispute': 'pulseSoftDispute 2.2s ease-in-out infinite',
        'draw-check': 'drawCheck 0.5s ease-out 0.1s both',
        'pop-in': 'popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'page-in': 'pageIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'drift-fizzle': 'driftFizzle var(--drift-duration, 22s) ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
