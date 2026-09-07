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
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
          overlay: 'var(--surface-overlay)'
        },
        content: {
          DEFAULT: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
          'on-accent': 'var(--text-on-accent)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          border: 'var(--accent-border)'
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger:  { DEFAULT: 'var(--danger)',  soft: 'var(--danger-soft)' },
        info:    { DEFAULT: 'var(--info)',    soft: 'var(--info-soft)' },
        area: {
          housing: 'var(--area-housing)',
          community: 'var(--area-community)',
          services: 'var(--area-services)',
          safety: 'var(--area-safety)'
        }
      },
      borderColor: {
        DEFAULT: 'var(--border-default)',
        default: 'var(--border-default)',
        strong: 'var(--border-strong)',
        subtle: 'var(--border-subtle)'
      },
      boxShadow: {
        e1: 'var(--elevation-1)',
        e2: 'var(--elevation-2)',
        e3: 'var(--elevation-3)',
        e4: 'var(--elevation-4)',
        focus: 'var(--focus-ring)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)'
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
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
