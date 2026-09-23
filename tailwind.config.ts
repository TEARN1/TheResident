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
        // Match the CSS variables in globals.css. Hex (not var()) so opacity
        // modifiers like bg-gold-primary/10 work.
        'gold-primary': '#D4AF37',
        'gold-secondary': '#B8860B',
        'glass': 'rgba(255, 255, 255, 0.05)',
        'glass-border': 'rgba(255, 255, 255, 0.1)',
        'surface': 'rgba(10, 10, 10, 0.65)'
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
        'glow': '0 0 15px rgba(212, 175, 55, 0.3)',
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
