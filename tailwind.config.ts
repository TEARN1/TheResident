import type { Config } from 'tailwindcss'

// The app is mostly inline-styled (React.CSSProperties); the newer dashboard
// tabs use Tailwind utilities. Preflight is OFF so Tailwind's base reset doesn't
// silently restyle the existing inline-styled screens — utilities still work.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        // Legacy brand aliases. Kept so the ~281 existing text-gold-primary
        // usages keep compiling while they are migrated to `accent`.
        'gold-primary': '#D4AF37',
        'gold-secondary': '#B8860B',

        // ── Design tokens (src/styles/tokens.css) ────────────────────────
        // Exposed as real Tailwind colours so components keep reading as
        // Tailwind — `bg-surface`, `text-muted` — while every value resolves
        // through a token and therefore through the theme.
        //
        // <alpha-value> is what lets opacity modifiers still work
        // (`bg-accent/10`); it requires the CSS variable to hold bare channel
        // numbers, which is why tokens.css also publishes *-rgb triplets.
        // ── Design tokens (src/styles/tokens.css, generated) ─────────────
        // Channel-based so opacity modifiers work: `bg-accent/10` compiles to
        // rgb(var(--accent-rgb) / 0.1). The app uses colour-with-opacity over
        // 400 times, so this is not a nicety.
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken-rgb) / <alpha-value>)'
        },
        content: {
          DEFAULT: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--text-subtle-rgb) / <alpha-value>)',
          'on-accent': 'rgb(var(--text-on-accent-rgb) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-rgb) / <alpha-value>)'
        },
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger:  'rgb(var(--danger-rgb) / <alpha-value>)',
        info:    'rgb(var(--info-rgb) / <alpha-value>)',
        hairline: 'rgb(var(--border-rgb) / <alpha-value>)',
        area: {
          housing: 'rgb(var(--area-housing-rgb) / <alpha-value>)',
          community: 'rgb(var(--area-community-rgb) / <alpha-value>)',
          services: 'rgb(var(--area-services-rgb) / <alpha-value>)',
          safety: 'rgb(var(--area-safety-rgb) / <alpha-value>)'
        }
      },
      borderColor: {
        DEFAULT: 'var(--border-default)',
        default: 'var(--border-default)',
        strong: 'var(--border-strong)',
        subtle: 'var(--border-subtle)'
      },
      boxShadow: {
        e1: 'var(--elevation-1)', e2: 'var(--elevation-2)',
        e3: 'var(--elevation-3)', e4: 'var(--elevation-4)',
        focus: 'var(--focus-ring)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)'
      },
      transitionDuration: {
        fast: 'var(--duration-fast)', base: 'var(--duration-base)',
        slow: 'var(--duration-slow)'
      },
      maxWidth: { content: 'var(--content-max)' },
      minHeight: { tap: 'var(--tap-min)' },
      minWidth: { tap: 'var(--tap-min)' }
    }
  },
  plugins: []
}

export default config
