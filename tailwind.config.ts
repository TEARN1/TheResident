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
        'gold-secondary': '#B8860B'
      }
    }
  },
  plugins: []
}

export default config
