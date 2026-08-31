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
    <div className="min-h-screen bg-black text-gray-300 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-gold-primary font-black uppercase tracking-widest hover:underline">← The Resident</Link>
          <h1 className="text-2xl font-black text-white mt-3">Privacy Policy</h1>
          <p className="text-xs text-gray-500 mt-1">Last updated: this document reflects what the app currently does, not a fixed date — check back if something here seems out of date.</p>
        </div>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li><strong className="text-white">Account info:</strong> name, username, email, and role (tenant, landlord, or visitor) when you sign up.</li>
            <li><strong className="text-white">Profile content:</strong> bio, photos, verification documents (e.g. a lease or utility bill), and preferences you choose to add.</li>
            <li><strong className="text-white">Location:</strong> only when you use a feature that needs it — searching the map, reporting an issue, sharing your live location with people you choose. We never collect location in the background.</li>
            <li><strong className="text-white">Content you post:</strong> gossip posts, comments, service reports, marketplace listings, messages, and any photos or short videos attached to them.</li>
            <li><strong className="text-white">Usage &amp; device info:</strong> basic error/session logs needed to keep the app working, and a push notification token if you enable notifications.</li>
          </ul>
        </Section>

        <Section title="What we don't do">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>We don&apos;t sell your data.</li>
            <li>We don&apos;t track your location in the background — only when a feature you&apos;re actively using needs it.</li>
            <li>We don&apos;t share your verification documents, private messages, or exact address with other residents — only what you explicitly choose to make visible (e.g. an approximate area, or a listing you publish).</li>
          </ul>
        </Section>

        <Section title="Who we share data with">
          <p className="text-sm leading-relaxed mb-2">The Resident runs on a small number of services that process data on our behalf, strictly to run the app:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li><strong className="text-white">Supabase</strong> — hosts our database, authentication, file storage, and realtime features.</li>
            <li><strong className="text-white">OpenStreetMap / Nominatim</strong> — turns a place you search or a location you drop a pin on into a real address, and back.</li>
            <li><strong className="text-white">Paystack</strong> — processes payments if you choose to pay for a visibility tier or a verification speed-up. We never see or store your card details ourselves.</li>
            <li><strong className="text-white">The Gruvs</strong> — a connected community app sharing the same account system (one login for both). See §5 of <code className="text-gold-primary">CONTRACT.md</code> in our public repository for exactly which fields are shared and which are never shared.</li>
          </ul>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>You can edit or delete most content you post at any time.</li>
            <li>Location sharing and push notifications are opt-in and can be turned off at any time in your device or browser settings.</li>
            <li>You can delete your account, which removes your profile, posts, and personal data from active use.</li>
          </ul>
        </Section>

        <Section title="Children">
          <p className="text-sm leading-relaxed">The Resident is not directed at children and is not intended for use by anyone under 18.</p>
        </Section>

        <Section title="Contact">
          <p className="text-sm leading-relaxed">Questions about this policy or your data — reach out through the contact details on our support channel listed in the app.</p>
        </Section>

        <p className="text-[11px] text-gray-600 pt-4 border-t border-white/5">
          Also see our <Link href="/terms" className="text-gold-primary hover:underline">Terms of Service</Link>.
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
