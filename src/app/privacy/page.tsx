import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — The Resident' }

/**
 * Public, no-login page — required for Google Play Console submission (every
 * app needs a reachable privacy policy URL, and one collecting location or
 * account data needs a Data Safety section that matches it) and generally
 * for anyone signing up to be able to read what happens to their data before
 * they do. Content is drawn directly from what this codebase actually does
 * (CONTRACT.md's table-ownership rules, the storage/upload conventions, the
 * third-party services actually called), not boilerplate.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface text-content px-4 py-12">
      <main id="main-content" className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center min-h-tap text-xs text-accent font-black uppercase tracking-widest hover:underline">← The Resident</Link>
          <h1 className="text-2xl font-black text-content mt-3">Privacy Policy</h1>
          <p className="text-xs text-content-muted mt-1">Last updated 7 September 2026. This describes what the app actually does today; it is revised whenever that changes.</p>
        </div>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li><strong className="text-content">Account info:</strong> name, username, email, and role (tenant, landlord, or visitor) when you sign up.</li>
            <li><strong className="text-content">Profile content:</strong> bio, photos, verification documents (e.g. a lease or utility bill), and preferences you choose to add.</li>
            <li><strong className="text-content">Location, used once:</strong> when you search the map, report an issue, or share your live location with people you choose. This is used at the moment you use the feature and is not kept as a location history. We never collect location in the background.</li>
            <li><strong className="text-content">Location, saved: your home area.</strong> If you choose to set one, we save a single point for where you live, so that official announcements for your ward or suburb can reach you. You pick whether it is saved <em>approximately</em> (rounded before it is stored, so we never hold your precise address) or exactly. It is stored once, not tracked over time, it is never shown to other residents, and you can remove it at any time from your Profile.</li>
            <li><strong className="text-content">Content you post:</strong> news posts, comments, service reports, marketplace listings, messages, and any photos or short videos attached to them.</li>
            <li><strong className="text-content">Usage &amp; device info:</strong> basic error/session logs needed to keep the app working, and a push notification token if you enable notifications.</li>
          </ul>
        </Section>

        <Section title="What we don't do">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>We don&apos;t sell your data.</li>
            <li>We don&apos;t track your location in the background, and we don&apos;t keep a history of where you have been. The home area above is a single saved point you set yourself, not a trail.</li>
            <li>We don&apos;t share your verification documents, private messages, or exact address with other residents — only what you explicitly choose to make visible (e.g. an approximate area, or a listing you publish).</li>
          </ul>
        </Section>

        <Section title="Who we share data with">
          <p className="text-sm leading-relaxed mb-2">The Resident runs on a small number of services that process data on our behalf, strictly to run the app:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li><strong className="text-content">Supabase</strong> — hosts our database, authentication, file storage, and realtime features.</li>
            <li><strong className="text-content">OpenStreetMap / Nominatim</strong> — turns a place you search or a location you drop a pin on into a real address, and back.</li>
            <li><strong className="text-content">Paystack</strong> — processes payments if you choose to pay for a visibility tier or a verification speed-up. We never see or store your card details ourselves.</li>
            <li><strong className="text-content">The Gruvs</strong> — a connected community app sharing the same account system (one login for both). See §5 of <code className="text-accent">CONTRACT.md</code> in our public repository for exactly which fields are shared and which are never shared.</li>
          </ul>
        </Section>

        <Section title="Where your data is stored">
          <p className="text-sm leading-relaxed">
            The Resident is built for South Africa, but our database is currently hosted by
            Supabase in Ireland (EU). That means your personal information is transferred
            outside South Africa to be stored and processed. Ireland is subject to the EU&apos;s
            GDPR, which provides a level of protection comparable to POPIA. We are working
            towards moving this hosting to a South African region.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p className="text-sm leading-relaxed">
            We keep your account and the content you post for as long as your account is
            open. If you delete your account, your profile and personal data are removed
            from active use. Some records are kept longer where we have to: safety and
            abuse reports, and basic security logs, so that a pattern of harm can still be
            investigated after someone deletes an account. Technical error logs are
            short-lived and are used only to fix faults.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>You can edit or delete most content you post at any time.</li>
            <li>Location sharing and push notifications are opt-in and can be turned off at any time in your device or browser settings.</li>
            <li>Your saved home area is optional. You can set it, change its precision, or remove it entirely from your Profile at any time.</li>
            <li>You can delete your account, which removes your profile, posts, and personal data from active use.</li>
          </ul>
        </Section>

        <Section title="Children">
          <p className="text-sm leading-relaxed">The Resident is not directed at children and is not intended for use by anyone under 18.</p>
        </Section>

        <Section title="Contact">
          <p className="text-sm leading-relaxed">Questions about this policy or your data — reach out through the contact details on our support channel listed in the app.</p>
        </Section>

        <p className="text-xs text-content-subtle pt-4 border-t border-subtle">
          Also see our <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link>.
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
