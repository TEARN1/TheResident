'use client'

// The last resort. error.tsx catches failures inside a page; this catches
// failures in the root layout itself, which is the case where even the app
// shell is gone.
//
// It therefore renders its own <html> and <body> — Next.js replaces the whole
// document here — and uses inline styles on purpose: if the layout failed, the
// stylesheet it loads may never have applied, so anything relying on Tailwind
// classes would render as unstyled text on white.

import React, { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error.message, error.digest ?? '')
  }, [error])

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        padding: '24px',
      }}>
        <div style={{ maxWidth: '380px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', lineHeight: 1, marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
            The Resident could not start
          </h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px', lineHeight: 1.5 }}>
            Something failed before the app could load. Nothing you saved has been lost.
            Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#D4AF37',
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Reload the app
          </button>
          {error.digest && (
            <p style={{ marginTop: '20px', fontSize: '10px', color: '#4b5563', fontFamily: 'monospace' }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
