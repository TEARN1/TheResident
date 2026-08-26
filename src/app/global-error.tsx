'use client'

import { useEffect } from 'react'

/**
 * Catches an error thrown by the ROOT LAYOUT itself (or anywhere error.tsx
 * can't reach, since error.tsx is rendered inside the layout it's meant to
 * protect). Next.js requires this to render its own complete <html>/<body>
 * — it fully replaces the root layout, which is presumably what's broken.
 * Deliberately plain, inline-styled markup: no Tailwind classes, no
 * ReduxProvider, no shared components — anything this depends on could be
 * exactly what's failing.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Root layout error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#e5e5e5', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '360px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>The app hit a problem</h1>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px' }}>
              Something went wrong loading The Resident. Your account and data are fine.
            </p>
            <button
              onClick={reset}
              style={{
                background: '#D4AF37', color: '#000', fontWeight: 700, border: 'none',
                borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer'
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
