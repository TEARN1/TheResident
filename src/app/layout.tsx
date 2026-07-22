import type { Metadata } from 'next'
import './globals.css'
import CustomCursor from './components/ui/CustomCursor'
import ScrollProgress from './components/ui/ScrollProgress'
import GoldParticles from './components/ui/GoldParticles'
import { ReduxProvider } from '../store/provider'

export const metadata: Metadata = {
  title: 'The Resident',
  description: 'Luxury Living Simplified for Tenants and Property Owners.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="day">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Resident" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body>
        <ReduxProvider>
          <CustomCursor />
          <ScrollProgress />
          <GoldParticles />
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </ReduxProvider>
      </body>
    </html>
  )
}
