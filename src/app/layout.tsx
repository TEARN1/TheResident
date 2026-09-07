import type { Metadata } from 'next'
import './globals.css'
import { ReduxProvider } from '../store/provider'
import { THEME_BOOT_SCRIPT } from '../utils/theme'

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
    // Theme is resolved by src/utils/theme.ts, which has three states, not
    // two. The previous version of this script read
    //     t === 'light' ? 'light' : 'night'
    // so anything that was not the exact string 'light' became dark —
    // including never having chosen, which is the common case. A resident
    // whose phone was set to light mode still got a dark app permanently,
    // and prefers-color-scheme was never consulted at all.
    //
    // Now: an explicit choice stamps an attribute and wins over the OS in
    // both directions; no choice removes the attribute so the media query in
    // tokens.css follows the device. This still runs before hydration, so
    // there is no flash of the wrong theme.
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* So the Android status bar and iOS Safari chrome match the app
            instead of clashing with it. Two entries, one per scheme. */}
        <meta name="theme-color" content="#FAF8F3" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#16140F" media="(prefers-color-scheme: dark)" />
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
                  // The ?v= is load-bearing, not cosmetic. The browser only
                  // reinstalls a service worker whose bytes changed, and
                  // /sw.js is a static file that never does — so without a
                  // changing query string a deploy never reaches anyone who
                  // installed the app, and sw.js names its cache after this
                  // value so activate() can purge the previous deploy's.
                  navigator.serviceWorker.register('/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID || 'dev'}')
                    .catch(function(err) {
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
