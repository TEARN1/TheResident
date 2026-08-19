'use client'

// The app had no error boundary at all. In the App Router that means a single
// render-time exception anywhere in a client component unmounts the tree and
// leaves a white screen — no message, no way back, nothing to report.
//
// For an app people open during a power cut to find water, a blank screen is
// not a degraded experience, it is a broken promise. This is the floor: keep
// the person oriented, give them a way out, and never lose the fact that it
// happened.

import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Next.js already logs this server-side; this makes it visible in a device
    // console too, which is often the only diagnostic available when someone
    // reports "it went white" from a phone we cannot reach.
    console.error('[app error boundary]', error.message, error.digest ?? '')
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="glass-panel max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={24} className="text-red-400" />
        </div>

        <h2 className="text-xl font-black text-white mb-2">This screen stopped working</h2>
        <p className="text-sm text-gray-400 mb-6">
          Something went wrong on our side, not yours. Your reports and messages are safe —
          nothing was lost.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-gold-primary text-black font-black px-5 py-3 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <RefreshCw size={15} /> Try again
          </button>
          <a
            href="/dashboard"
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black px-5 py-3 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
          >
            <Home size={15} /> Go home
          </a>
        </div>

        {/* The digest is the only handle on a production error whose stack has
            been stripped. Shown quietly so someone reporting a problem can
            read it out, without making the screen look like a stack trace. */}
        {error.digest && (
          <p className="mt-5 text-[10px] text-gray-600 font-mono">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
