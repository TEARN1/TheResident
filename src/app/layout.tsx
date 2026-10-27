import type { Metadata, Viewport } from 'next'
import './globals.css'
import { siteUrl } from './site-url'

export const viewport: Viewport = {
  themeColor: '#051F20',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'The Resident Crew',
  description: 'Find a room you can trust: real rooms from real landlords, with a fair-price check on every one. Plus SOS alerts, local services and trade with your neighbours.',
  // Link previews (WhatsApp, Facebook, X). The image is app/opengraph-image.tsx.
  openGraph: {
    type: 'website',
    siteName: 'The Resident',
    title: 'The Resident: find a room you can trust',
    description: 'Real rooms from real landlords, a fair-price check on every one, and neighbours who have your back.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Resident: find a room you can trust',
    description: 'Real rooms from real landlords, a fair-price check on every one, and neighbours who have your back.',
  },
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
        {/* The Redux store is provided by the auth and dashboard layouts, so
            the home page and info pages don't load it or Supabase. */}
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  // When a new release's service worker takes over, reload
                  // once so the page on screen is the new version too (only
                  // when one was already in control, so no loop on first install).
                  var hadController = !!navigator.serviceWorker.controller;
                  var reloaded = false;
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    if (!hadController || reloaded) return;
                    reloaded = true;
                    window.location.reload();
                  });
                  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function(err) {
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
