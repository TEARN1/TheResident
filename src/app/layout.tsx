import type { Metadata } from 'next'
import './globals.css'
import CustomCursor from './components/ui/CustomCursor'
import ScrollProgress from './components/ui/ScrollProgress'
import GoldParticles from './components/ui/GoldParticles'
import { ReduxProvider } from '../store/provider'

export const metadata: Metadata = {
  title: 'The Resident',
  description: 'Luxury Living Simplified for Tenants and Property Owners.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Resident',
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
          <CustomCursor />
          <ScrollProgress />
          <GoldParticles />
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
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
