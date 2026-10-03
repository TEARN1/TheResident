'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertOctagon, RotateCcw, Home } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log unexpected client exceptions
    console.error('The Resident App Error caught by boundary:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[var(--background,#051F20)] text-[var(--foreground,#F0F7F4)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[var(--gold-primary,#8EB69B)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[var(--card-bg,rgba(11,43,38,0.7))] border border-[var(--glass-border,rgba(142,182,155,0.2))] backdrop-blur-2xl shadow-2xl relative z-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center shadow-lg">
          <AlertOctagon size={32} />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--gold-primary,#8EB69B)] px-3 py-1 rounded-full bg-[var(--gold-dim,rgba(142,182,155,0.1))] border border-[var(--glass-border,rgba(142,182,155,0.2))]">
            Session Recovery
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white mt-2">
            Something unexpected occurred
          </h1>
          <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
            {error?.message && error.message.length < 120
              ? error.message
              : 'The Resident encountered a temporary hiccup. Your data and session are safe.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-2xl bg-[var(--gold-primary,#8EB69B)] text-black font-black text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <RotateCcw size={14} /> Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Home size={14} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
