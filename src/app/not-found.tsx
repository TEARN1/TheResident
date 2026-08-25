import Link from 'next/link'

/**
 * 404. Without this file Next renders its own unstyled default, which on a
 * dark, gold-branded app reads as "the site is broken" rather than "that
 * page doesn't exist".
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <div className="glass-panel max-w-md w-full p-8 text-center space-y-4">
        <p className="text-5xl font-black text-gold-primary">404</p>
        <h1 className="text-lg font-bold text-white">We couldn&apos;t find that page</h1>
        <p className="text-sm text-gray-500">
          The link may be out of date, or the listing, room or conversation it pointed to may have been removed.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Link
            href="/dashboard"
            className="flex-1 bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
