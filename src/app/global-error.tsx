'use client'

import React, { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Critical Global Error caught:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#051F20',
        color: '#F0F7F4',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          maxWidth: '420px',
          width: '90%',
          padding: '32px',
          borderRadius: '24px',
          background: 'rgba(11, 43, 38, 0.85)',
          border: '1px solid rgba(142, 182, 155, 0.3)',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            !
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px', color: '#ffffff' }}>
            System Recovery
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.5, marginBottom: '24px' }}>
            The application experienced an unexpected interruption. We are preserving your state.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '12px 24px',
                borderRadius: '14px',
                background: '#8EB69B',
                color: '#051F20',
                border: 'none',
                fontWeight: 900,
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer'
              }}
            >
              Restart App
            </button>
            <a
              href="/dashboard"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                padding: '12px 24px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontWeight: 900,
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer'
              }}
            >
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
