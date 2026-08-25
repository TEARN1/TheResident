'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Catches a thrown render error anywhere under the root layout. Without it,
 * an exception in any page took the whole app to Next's raw default error
 * screen with no branding and no way back other than the browser's own
 * back button.
 *
 * Deliberately does NOT print `error.message` to the user: a raw error can
 * carry table names, RLS policy names or query fragments, which SECURITY.md
 * already calls out as an info-disclosure risk. The digest is shown instead
 * because it is the value that correlates to the server log entry, which is
 * what actually helps when someone reports a problem.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side logs already capture this; the console line is what makes
    // it visible while developing.
    console.error('Unhandled render error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <div className="glass-panel max-w-md w-full p-8 text-center space-y-4">
        <AlertTriangle size={40} className="text-gold-primary mx-auto" />
        <h1 className="text-lg font-bold text-white">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          This one is on us, not you. Nothing you had saved is affected — anything queued while
          offline is still waiting to sync.
        </p>
        {error.digest && (
          <p className="text-[10px] text-gray-600 font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            <RefreshCw size={13} /> Try again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
