import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'

export const metadata: Metadata = {
  title: 'Terms of Use — The Resident',
  description: 'The rules for using The Resident community app.',
  alternates: { canonical: '/terms' },
}

// DRAFT: a starting point, not legal advice. Have it reviewed before relying on it.
export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className={styles.updated}>Last updated: 27 September 2026</p>

      <p>By creating an account or using The Resident, you agree to these terms.</p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate information and keep your login details safe.</li>
        <li>You are responsible for what happens on your account.</li>
        <li>One person, one account.</li>
      </ul>

      <h2>How to behave</h2>
      <p>Do not use The Resident to:</p>
      <ul>
        <li>harass, threaten or discriminate against anyone;</li>
        <li>post false, misleading or illegal listings;</li>
        <li>share someone else&apos;s personal information without their permission;</li>
        <li>send false safety alerts;</li>
        <li>spam, scam or try to break the service.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>Dealing with other residents</h2>
      <p>
        The Resident connects you with neighbours, but we are not a party to the deals you make —
        hiring a service, renting a room, buying an item or sharing a lift. Check who you are
        dealing with, use ratings, and take sensible precautions. We are not responsible for the
        conduct of other users or the quality of what they offer.
      </p>

      <h2>Safety alerts</h2>
      <p>Alerts depend on other residents responding. They are not an emergency service. In an emergency, call 10111 or 112.</p>

      <h2>Your content</h2>
      <p>You keep ownership of what you post. You allow us to display it within the service so it can do what you posted it for.</p>

      <h2>The service</h2>
      <p>We work to keep The Resident available and accurate but provide it &ldquo;as is&rdquo;. We may change or stop features.</p>

      <h2>Contact</h2>
      <p>Questions about these terms? <Link href="/contact">Contact us</Link>. See also our <Link href="/privacy">privacy policy</Link>.</p>
    </>
  )
}
