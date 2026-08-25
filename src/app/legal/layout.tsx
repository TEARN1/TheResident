import Link from 'next/link'

/**
 * Shared shell for the legal pages. Deliberately outside /dashboard so it
 * is reachable without an account — a privacy notice you must sign up to
 * read defeats its purpose, and POPIA expects it to be available before
 * someone hands over their data.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <Link href="/" className="text-gold-primary font-black tracking-widest text-sm uppercase">
            The Resident
          </Link>
          <nav className="flex gap-4 text-xs">
            <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-white">Terms</Link>
          </nav>
        </header>

        <article className="space-y-6 text-sm leading-relaxed [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:text-white [&_h3]:font-semibold [&_h3]:text-sm [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-gold-primary [&_a]:underline [&_strong]:text-white">
          {children}
        </article>

        <footer className="border-t border-white/10 pt-4 text-xs text-gray-600">
          <Link href="/" className="hover:text-white">← Back to The Resident</Link>
        </footer>
      </div>
    </div>
  )
}
