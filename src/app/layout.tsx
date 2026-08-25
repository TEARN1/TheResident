import type { Metadata } from 'next'
import './globals.css'
import { ReduxProvider } from '../store/provider'
import { Analytics } from '@vercel/analytics/next'

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
                document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'night');
              } catch (e) {
                document.documentElement.setAttribute('data-theme', 'night');
              }
            `
          }}
        />
      </head>
      <body>
        <ReduxProvider>
          {children}
        </ReduxProvider>
        {/* Core Web Vitals from real devices, which is the only measurement
            that reflects the low-end Android handsets this app targets — a
            local Lighthouse run on a dev machine never will. No cookies and
            no cross-site identifiers, so it needs no consent banner, and it
            is inert unless the deployment is on Vercel. */}
        <Analytics />
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
