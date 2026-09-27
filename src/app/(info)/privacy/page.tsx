import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'

export const metadata: Metadata = {
  title: 'Privacy Policy — The Resident',
  description: 'How The Resident collects, uses and protects your personal information.',
  alternates: { canonical: '/privacy' },
}

// DRAFT: a starting point written from what the app does. Have it reviewed
// for POPIA compliance before relying on it.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className={styles.updated}>Last updated: 27 September 2026</p>

      <p>
        This policy explains what personal information The Resident collects, why, and what you can
        do about it. We process personal information in line with South Africa&apos;s Protection of
        Personal Information Act (POPIA).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> — your name, email address, and profile photo if you add one. If you sign in with Facebook, we receive your basic profile from them.</li>
        <li><strong>Community details</strong> — your suburb, your role (tenant, landlord or visitor) and the communities you join.</li>
        <li><strong>What you post</strong> — listings, services, messages, ratings, alerts and other content you create.</li>
        <li><strong>Location</strong> — only when you choose to share it, for example with a safety alert or on the map.</li>
        <li><strong>Technical data</strong> — basic device and log information needed to keep the service running and secure.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account and show you what is happening in your suburb.</li>
        <li>To let you contact and trade with neighbours.</li>
        <li>To calculate ratings and reputation.</li>
        <li>To send safety alerts to the people you choose.</li>
        <li>To keep the service secure and prevent abuse.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Who can see your information</h2>
      <p>
        Messages, alerts, your trust circle and your profile are visible only to signed-in members,
        within the limits each feature sets. Content you deliberately publish, such as a service
        listing, may be visible to other members of your community.
      </p>
      <p>
        We use service providers to host the app and its data. They process information only on our
        behalf.
      </p>

      <h2>How long we keep it</h2>
      <p>We keep your information while your account is active and delete it when it is no longer needed, unless the law requires us to keep it.</p>

      <h2>Your rights</h2>
      <p>You may ask to see, correct or delete your personal information, or object to how we use it. You may also complain to the Information Regulator of South Africa.</p>
      <p>To make a request, <Link href="/contact">contact us</Link>.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we will update the date above and tell you in the app when the change is significant.</p>
    </>
  )
}
