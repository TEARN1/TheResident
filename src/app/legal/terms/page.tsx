import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use — The Resident',
  description: 'The rules for using The Resident, and what it does and does not guarantee.'
}

// ⚠️  Written against what the app actually does — the free-tier promise in
// utils/pricing.ts, the trust-gate and verification behaviour, the
// off-platform-payment detection, the "flag, never auto-restrict"
// moderation stance. Still needs review by someone qualified, and the
// operating entity's legal name, before publishing. See the note at the
// top of ../privacy/page.tsx.

const OPERATOR_CONTACT = 'OPERATOR_TODO: add a real contact address'

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-black text-white">Terms of Use</h1>

      <h2>What this app is</h2>
      <p>
        The Resident is a place for neighbours to list rooms, offer services, trade locally and
        keep an eye out for each other. It is an <strong>introduction service</strong>. It is not
        an estate agent, a landlord, a letting agency, an escrow service or an insurer, and it is
        not a party to any agreement you reach with another person through it.
      </p>

      <h2>Money never moves through this app</h2>
      <p>
        There is no payment processing here. Rent, deposits, marketplace purchases and payment for
        services are arranged directly between you and the other person. That means:
      </p>
      <ul>
        <li>Nobody can refund you through the app, because nobody took your money through it.</li>
        <li>Deposits are a private arrangement — get it in writing.</li>
        <li>Anyone pressuring you to pay off-platform urgently, especially before you have seen a
          room, is a common scam pattern. The app flags some of these automatically, but it cannot
          catch all of them.</li>
      </ul>

      <h2>Verification is a signal, not a guarantee</h2>
      <p>
        A verified badge means an account cleared a review step. It does not mean we have vetted
        that person&apos;s honesty, their right to let a property, or the condition of what they
        are offering. Trust badges, reputation tiers and next-of-kin circles are there to help you
        judge — they are not a warranty, and you remain responsible for your own due diligence.
        <strong> View a room in person before paying anyone anything.</strong>
      </p>

      <h2>The free tier is real</h2>
      <p>
        Paid items only ever buy <strong>speed or visibility</strong> — a faster place in the
        verification queue, a boosted listing, priority placement. Paying never buys a better
        outcome, and never buys trust. Every core function of this app works without paying, and
        a free account is never excluded from anything, only ordered later in a list.
      </p>

      <h2>What you agree to</h2>
      <ul>
        <li>Be truthful in your profile and listings.</li>
        <li>Only list property you are actually entitled to let.</li>
        <li>Do not harass, threaten, impersonate or discriminate against other residents.</li>
        <li>Do not use safety features — panic alerts, closure reports, disputes — to mislead. People act on those.</li>
        <li>Do not scrape the app or use it to build a marketing list. Broadcast messaging is opt-in only, by design.</li>
        <li>You must be 18 or over.</li>
      </ul>

      <h2>Moderation</h2>
      <p>
        Content and accounts can be reported. Automated rules flag suspicious activity — unusually
        low prices, duplicated photos, pressure to pay off-platform — but a flag is only ever a
        prompt for a human to look. Automated detection never restricts an account on its own.
        Serious or repeated breaches can lead to removal of content or of the account.
      </p>

      <h2>Availability</h2>
      <p>
        This is a small, independently run app. It may be unavailable at times, and writes made
        offline sync when you reconnect. It is provided as-is, without a guarantee of
        uninterrupted service, and it should not be relied on as your only means of contact in an
        emergency — <strong>call the real emergency services first.</strong>
      </p>

      <h2>Limits</h2>
      <p>
        To the extent the law allows, The Resident is not liable for losses arising from dealings
        between users, including tenancies, purchases, services or lifts arranged through it.
        Nothing here limits liability that cannot lawfully be limited, and nothing here removes any
        right you have under South African consumer or rental law.
      </p>

      <h2>Contact</h2>
      <p>{OPERATOR_CONTACT}</p>
    </>
  )
}
