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
    <div className="min-h-screen bg-surface text-content px-4 py-12">
      <main id="main-content" className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center min-h-tap text-xs text-accent font-black uppercase tracking-widest hover:underline">← The Resident</Link>
          <h1 className="text-2xl font-black text-content mt-3">Terms of Service</h1>
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

        <Section title="Safety features are not emergency services">
          <p className="text-sm leading-relaxed mb-2">
            <strong className="text-content">
              Do not rely on The Resident in an emergency. Call 10111 (police), 10177 (ambulance),
              or 112 from any mobile.
            </strong>
          </p>
          <p className="text-sm leading-relaxed">
            Panic alerts, mutual-aid check-ins and neighbourhood status reports are a way for
            neighbours to tell each other things. They are delivered inside the app, over the
            internet, to residents who have joined a community or shared their area — so they can
            be delayed, or reach nobody at all, for reasons outside our control: no signal, a
            phone that is off, notifications switched off, or simply nobody nearby using the app
            yet. We do not monitor alerts, we do not dispatch help, and we cannot guarantee that
            anyone will see or respond to one.
          </p>
        </Section>

        <Section title="We connect people, we are not a party to what you agree">
          <p className="text-sm leading-relaxed">
            Listings, rooms, services and marketplace items are posted by residents, not by us. We
            are not an estate agent, letting agent, broker or employer, and we are not a party to
            any lease, sale, job or payment you agree with another user. We do not hold your money.
            We do not inspect properties or vet the people you meet through the app, and a
            &ldquo;verified&rdquo; badge means only that someone submitted a document we looked
            at — it is not a guarantee of honesty, safety or solvency. Meet in public, check
            documents yourself, and never pay a deposit for a place you have not seen.
          </p>
        </Section>

        <Section title="Content posted by residents">
          <p className="text-sm leading-relaxed">
            You are responsible for what you post, including anything you say about a landlord,
            a business or a service provider. Do not post anything untrue, private to someone
            else, or intended to harass. We can remove content and suspend accounts, and we will
            act on a reasonable complaint — contact us through the support channel listed in the
            app. Content you post may remain visible to others until it is removed.
          </p>
        </Section>

        <Section title="Changes">
          <p className="text-sm leading-relaxed">
            We may update these terms as the app changes. Continued use after an update means you accept the current terms.
          </p>
        </Section>

        <p className="text-xs text-content-subtle pt-4 border-t border-subtle">
          Also see our <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-black text-accent uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}
