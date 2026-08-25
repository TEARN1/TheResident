'use client'

/**
 * Last resort: catches errors thrown by the root layout itself, where
 * error.tsx cannot help because the layout that would wrap it is the thing
 * that failed. Next requires this file to render its own <html>/<body>.
 *
 * Styles are inline rather than Tailwind classes on purpose — if the root
 * layout failed, the stylesheet it loads may not have been applied either,
 * and a "something went wrong" screen that itself renders unstyled is a
 * poor last impression.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '2rem',
            background: 'rgba(255,255,255,0.03)'
          }}>
            <h1 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>The Resident couldn&apos;t start</h1>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1rem' }}>
              Something failed before the app could load. Reloading usually clears it.
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.7rem', color: '#6b7280', fontFamily: 'monospace', marginBottom: '1rem' }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                background: '#D4AF37',
                color: '#000',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.5rem',
                fontWeight: 900,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                cursor: 'pointer'
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
