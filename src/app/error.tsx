'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Card from '../components/ui/Card'
import GoldButton from '../components/ui/GoldButton'

/**
 * Route-level error boundary — the app had none anywhere (no error.tsx,
 * no global-error.tsx, no component-level boundary), so one uncaught render
 * exception in any page white-screened the whole app with zero recovery UI.
 * Next.js renders this automatically in place of the failed segment; it
 * does NOT catch errors thrown by the root layout itself — that's what
 * global-error.tsx is for.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Not a replacement for real error tracking — just keeps the failure
    // visible in the console instead of silently vanishing behind this page.
    console.error('Route render error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--background)' }}>
      <Card padding="lg" className="max-w-sm w-full text-center space-y-4">
        <AlertTriangle size={36} className="mx-auto text-gold-primary opacity-70" />
        <h1 className="text-lg font-bold text-white">Something went wrong</h1>
        <p className="text-sm text-gray-400">
          This page hit an unexpected error. Your account and data are fine — try again, or head back to the dashboard.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <GoldButton onClick={reset} fullWidth>
            <RefreshCw size={15} /> Try again
          </GoldButton>
          <Link
            href="/dashboard"
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-black px-4 py-2.5 rounded-xl transition-all text-xs uppercase tracking-widest"
          >
            Back to dashboard
          </Link>
        </div>
      </Card>
    </div>
  )
}
