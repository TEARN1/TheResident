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
    <html lang="en" data-theme="day">
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
