import Link from 'next/link'

export const metadata = { title: 'Terms of Service — The Resident' }

/**
 * Public, no-login page — a store listing (Google Play, App Store) and a
 * basic account signup both expect a reachable terms page. Kept short and
 * specific to what this app actually is (community reporting, marketplace,
 * housing listings, user-generated content) rather than a generic template.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-gray-300 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-gold-primary font-black uppercase tracking-widest hover:underline">← The Resident</Link>
          <h1 className="text-2xl font-black text-white mt-3">Terms of Service</h1>
        </div>

        <Section title="What The Resident is">
          <p className="text-sm leading-relaxed">
            The Resident is a community platform for residents to report local infrastructure
            issues, find housing and roommates, connect with local businesses and services, and
            keep up with what&apos;s happening nearby. Content is largely user-generated — posts,
            listings, and reports come from the community, not from us.
          </p>
        </Section>

        <Section title="Your responsibilities">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>Post honestly — false infrastructure reports, fake listings, or impersonating an organisation (a utility, a municipality) is not allowed and may result in account action.</li>
            <li>Respect other residents — harassment, hate speech, or targeted abuse gets content removed and can get an account suspended.</li>
            <li>You&apos;re responsible for the accuracy of what you post — a room listing, a service report, a marketplace item.</li>
            <li>Verification documents you upload (for address or identity verification) must be genuine and your own.</li>
          </ul>
        </Section>

        <Section title="Payments">
          <p className="text-sm leading-relaxed">
            Some features (visibility tiers, verification speed-ups) are optional paid upgrades processed through Paystack.
            Pricing is shown before you pay. Refunds are handled case by case — contact us through the app&apos;s support channel.
          </p>
        </Section>

        <Section title="No warranty">
          <p className="text-sm leading-relaxed">
            Service reports, outage statuses, and provider response times shown in the app are self-reported by the
            community and are informational, not a guarantee of when an issue will actually be fixed. We do our best
            to keep the platform accurate and available but make no warranty that it will be error-free or uninterrupted.
          </p>
        </Section>

        <Section title="Changes">
          <p className="text-sm leading-relaxed">
            We may update these terms as the app changes. Continued use after an update means you accept the current terms.
          </p>
        </Section>

        <p className="text-[11px] text-gray-600 pt-4 border-t border-white/5">
          Also see our <Link href="/privacy" className="text-gold-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}
