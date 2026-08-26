import Link from 'next/link'
import { MapPinOff } from 'lucide-react'
import Card from '../components/ui/Card'

/**
 * The app had no not-found.tsx at all — a bad/stale URL fell through to
 * whatever the layout happened to render by default instead of an actual
 * 404. Kept as a server component (no 'use client') since it's fully static.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--background)' }}>
      <Card padding="lg" className="max-w-sm w-full text-center space-y-4">
        <MapPinOff size={36} className="mx-auto text-gold-primary opacity-70" />
        <h1 className="text-lg font-bold text-white">Page not found</h1>
        <p className="text-sm text-gray-400">
          Nothing lives at this address — it may have moved, or the link was mistyped.
        </p>
        <Link
          href="/dashboard"
          className="inline-block w-full bg-gold-primary hover:opacity-90 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm"
        >
          Back to dashboard
        </Link>
      </Card>
    </div>
  )
}
