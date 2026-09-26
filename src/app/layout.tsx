import type { Metadata } from 'next'
import './globals.css'
import { ReduxProvider } from '../store/provider'

export const metadata: Metadata = {
  title: 'The Resident Crew',
  description: 'Co-Living, Accommodations Trading & Community Portal for The Resident Crew — Connected with The Gruvs.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Resident Crew',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // No hardcoded data-theme here anymore — it used to be a permanent
    // "day" that CSS never even styled (globals.css only has 'night'/
    // 'light' blocks), and every page that DID toggle a theme (auth,
    // dashboard) wrote to its own separate localStorage key, so a choice
    // made on one never showed up on the other. This inline script runs
    // before React hydrates and sets data-theme from the one shared key
    // every page now reads/writes, avoiding a flash of the wrong theme.
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('residentTheme');
                var validThemes = ['minimal-green', 'crimson-cyber', 'liquid-glass', 'midnight-violet', 'light', 'night'];
                if (t && validThemes.indexOf(t) !== -1) {
                  document.documentElement.setAttribute('data-theme', t);
                } else {
                  document.documentElement.setAttribute('data-theme', 'minimal-green');
                }
              } catch (e) {
                document.documentElement.setAttribute('data-theme', 'minimal-green');
              }
            `
          }}
        />
      </head>
      <body>
        <ReduxProvider>
          {children}
        </ReduxProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}
