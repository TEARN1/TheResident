import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
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
  title: {
    default: 'The Resident Crew | Rooms to Rent, Student Housing & Local Services in South Africa',
    template: '%s | The Resident Crew',
  },
  description:
    'Find verified rooms to rent, student accommodation, and trusted local services across South Africa (Braamfontein, Auckland Park, Hatfield, Soweto). Zero broker fees, fair-price checks, and neighbourhood safety alerts.',
  keywords: [
    'rooms to rent',
    'student accommodation South Africa',
    'student housing Braamfontein',
    'Auckland Park student rooms',
    'Hatfield student accommodation',
    'Soweto rooms to rent',
    'verified landlords',
    'zero broker fees',
    'fair price rent check',
    'local handymen South Africa',
    'spaza shop directory',
    'neighbourhood safety alerts',
    'The Resident Crew',
    'co-living South Africa'
  ],
  authors: [{ name: 'The Resident Crew', url: siteUrl() }],
  creator: 'The Resident Crew',
  publisher: 'The Resident Crew',
  formatDetection: {
    email: false,
    address: true,
    telephone: false,
  },
  alternates: {
    canonical: '/',
    languages: {
      'en-ZA': '/',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: siteUrl(),
    siteName: 'The Resident Crew',
    title: 'The Resident Crew | Find a Room You Can Trust in South Africa',
    description:
      'Verified rooms from real landlords, fair-price checks on every listing, and neighbours who have your back across South African suburbs.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'The Resident Crew — Verified Rooms & Neighbourhood Community in South Africa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Resident Crew | Find a Room You Can Trust in South Africa',
    description:
      'Verified rooms from real landlords, fair-price checks on every listing, and neighbours who have your back across South African suburbs.',
    images: ['/opengraph-image'],
    creator: '@TheResidentCrew',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
    ],
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
  const base = siteUrl()
  const globalJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: base,
        name: 'The Resident Crew',
        alternateName: ['The Resident', 'Resident Crew', 'The Resident South Africa'],
        description:
          'Verified rooms to rent, student accommodation, and local services across South African neighbourhoods.',
        inLanguage: 'en-ZA',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${base}/dashboard/housing?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'The Resident Crew',
        url: base,
        logo: {
          '@type': 'ImageObject',
          url: `${base}/logo.png`,
          width: 512,
          height: 512,
        },
        sameAs: [
          'https://twitter.com/TheResidentCrew',
          'https://facebook.com/TheResidentCrew',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          url: `${base}/contact`,
          areaServed: 'ZA',
          availableLanguage: ['English', 'isiZulu', 'Sesotho', 'Afrikaans'],
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${base}/#app`,
        name: 'The Resident',
        operatingSystem: 'Android, iOS, Web',
        applicationCategory: 'RealEstateApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'ZAR',
        },
      },
    ],
  }

  return (
    // No hardcoded data-theme here anymore — it used to be a permanent
    // "day" that CSS never even styled (globals.css only has 'night'/
    // 'light' blocks), and every page that DID toggle a theme (auth,
    // dashboard) wrote to its own separate localStorage key, so a choice
    // made on one never showed up on the other. This inline script runs
    // before React hydrates and sets data-theme from the one shared key
    // every page now reads/writes, avoiding a flash of the wrong theme.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(globalJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Script
          id="resident-theme-init"
          strategy="beforeInteractive"
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
              try {
                if (location.hostname !== 'localhost') {
                  var out = window.console;
                  out.log('%cStop', 'font-size:28px;font-weight:700;color:#e11d48');
                  out.log('This is a tool for developers. If someone told you to copy or paste something here, it is a scam that can give them your account. Close this window.');
                }
              } catch (e) {}
              try {
                var m = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
                var n = navigator, c = n.connection || {};
                var blur = window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
                var slow = (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2);
                var solid = !blur || slow || c.saveData || m('(prefers-reduced-transparency: reduce)') || m('(forced-colors: active)');
                document.documentElement.setAttribute('data-glass', solid ? 'off' : 'on');
              } catch (e) {
                document.documentElement.setAttribute('data-glass', 'on');
              }
            `
          }}
        />
        {/* The Redux store is provided by the auth and dashboard layouts, so
            the home page and info pages don't load it or Supabase. */}
        {children}
        <Script
          id="resident-sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  var hadController = !!navigator.serviceWorker.controller;
                  var reloaded = false;
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    if (!hadController || reloaded) return;
                    reloaded = true;
                    window.location.reload();
                  });
                  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function() {});
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}
