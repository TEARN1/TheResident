import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'

export const metadata: Metadata = {
  title: 'Contact The Resident',
  description: 'Get in touch with The Resident team for support, feedback, reports or business enquiries.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact The Resident',
    description: 'Get in touch with The Resident team for support, feedback, reports or business enquiries.',
    url: `${siteUrl()}/contact`,
  },
}

// Set NEXT_PUBLIC_CONTACT_EMAIL to the team's real inbox. No address is
// hardcoded because none is confirmed yet.
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export default function ContactPage() {
  const base = siteUrl()
  const contactJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact The Resident',
    description: 'Get in touch with The Resident support team for assistance, reporting listings, or neighbourhood partnerships.',
    url: `${base}/contact`,
    mainEntity: {
      '@type': 'Organization',
      name: 'The Resident Crew',
      url: base,
      email: contactEmail || undefined,
    },
  }

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Contact', href: '/contact' },
        ]}
      />
      <JsonLd data={contactJsonLd} />
      <h1>Contact us</h1>
      <p>We&apos;d like to hear from you — whether you need help, want to report something, or have an idea.</p>

      {contactEmail ? (
        <p>
          Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      ) : (
        <p>Our support email address is coming soon.</p>
      )}

      <h2>Before you write</h2>
      <ul>
        <li>Many questions are answered in the <Link href="/faq">FAQ</Link>.</li>
        <li>To report a person or listing, include their name and a short description of what happened.</li>
        <li>For privacy requests (seeing or deleting your data), see our <Link href="/privacy">privacy policy</Link>.</li>
      </ul>

      <h2>Emergencies</h2>
      <p>
        The Resident is not an emergency service. If you are in danger, call SAPS on <strong>10111</strong> or <strong>112</strong> from a mobile phone.
      </p>
    </>
  )
}
