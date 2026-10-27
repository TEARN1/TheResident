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
        // Theme tokens from globals.css as "R G B" channels, so opacity
        // modifiers (bg-gold-primary/10, border-white/5) follow the theme.
        // black = surfaces, white = foreground, gray = the steps between.
        black: 'rgb(var(--surface) / <alpha-value>)',
        white: 'rgb(var(--fg) / <alpha-value>)',
        gray: {
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
          950: 'rgb(var(--surface) / <alpha-value>)'
        },
        'gold-primary': 'rgb(var(--accent) / <alpha-value>)',
        'gold-secondary': 'rgb(var(--accent-2) / <alpha-value>)',
        'glass': 'rgb(var(--fg) / 0.05)',
        'glass-border': 'rgb(var(--fg) / 0.1)',
        'surface': 'rgb(var(--surface) / 0.65)'
      },
      backdropBlur: {
        '2xl': '40px',
        '3xl': '64px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow': '0 0 18px rgb(var(--accent) / 0.35)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        }
      }
    }
  },
  plugins: []
}

export default config
