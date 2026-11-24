import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'

export const metadata: Metadata = {
  title: 'FAQ — Frequently Asked Questions | The Resident Crew',
  description:
    'Answers about The Resident Crew: zero broker fees, Rental Housing Act deposit checks, 5-second panic beacon, covered suburbs, and Founder Asemahle "TEARN" Nkwali.',
  keywords: [
    'The Resident Crew FAQ',
    'zero broker rental rooms South Africa',
    'Rental Housing Act deposit check',
    'neighbourhood safety panic beacon South Africa',
    'Asemahle TEARN Nkwali TEARN Ventures',
  ],
  alternates: { canonical: '/faq' },
  openGraph: {
    type: 'website',
    title: 'FAQ — Frequently Asked Questions | The Resident Crew',
    description:
      'Answers about zero-broker rooms, neighbourhood safety alerts, Rental Housing Act checks, and installing The Resident Crew.',
    url: `${siteUrl()}/faq`,
    siteName: 'The Resident Crew',
    locale: 'en_ZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'The Resident Crew FAQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ — Frequently Asked Questions | The Resident Crew',
    description:
      'Answers about zero-broker rooms, neighbourhood safety alerts, and local services on The Resident Crew.',
    images: ['/opengraph-image'],
  },
}

const faqs: { q: string; a: string }[] = [
  {
    q: 'What is The Resident Crew?',
    a: 'South Africa’s free community operating system for neighbourhoods. Residents use it to find verified rooms to rent, hire neighbour-rated local services, ride smarter with live precinct radar, and send real-time safety alerts.',
  },
  {
    q: 'Are there broker or agent commission fees on rooms?',
    a: 'No. Tenants, students, and landlords connect directly on The Resident Crew with zero broker commissions or middleman markups.',
  },
  {
    q: 'How does the Rental Housing Act deposit check work?',
    a: 'Before signing a lease, residents can review key protections under South Africa’s Rental Housing Act — including interest-bearing deposit rules, mandatory incoming and outgoing joint inspections, and lawful notice periods.',
  },
  {
    q: 'How do safety alerts and the 5-second panic beacon work?',
    a: 'Holding the panic control triggers a rapid alert to your trust circle and nearby verified suburb members on the live radar. Community alerts complement — and never replace — official emergency numbers like 10111 or 112.',
  },
  {
    q: 'Which suburbs and universities does The Resident Crew cover?',
    a: 'The Resident Crew covers major residential suburbs and university corridors across Johannesburg, Pretoria, Cape Town, Durban, Gqeberha, and Bloemfontein — including Soweto, Braamfontein, Auckland Park, Hatfield, Rondebosch, Stellenbosch, and Sunnyside.',
  },
  {
    q: 'Who founded The Resident Crew?',
    a: 'The Resident Crew was founded by South African software entrepreneur Asemahle "TEARN" Nkwali, Founder & CEO of TEARN Ventures, which also operates The Gruvs (thegruvs.com) and Excellency Academy (excellencyacs.com).',
  },
  {
    q: 'Who can join and how do I sign up?',
    a: 'Anyone who lives in, rents in, owns property in, or commutes through a South African suburb can sign up free with email or social login on the auth page.',
  },
  {
    q: 'Can I list my business, trade, or spaza shop?',
    a: 'Yes. Service providers and local shops can publish public directory pages that appear directly in Google Search and local suburb guides.',
  },
  {
    q: 'How do community ratings and trust work?',
    a: 'After hiring a tradesperson, buying locally, or inspecting a room, residents rate their experience so reliable neighbours and landlords stand out.',
  },
  {
    q: 'Is my personal information public?',
    a: 'No. Private messages, trust circles, and personal contact details remain protected; only listings you explicitly mark public appear on web search pages.',
  },
  {
    q: 'Can I install The Resident Crew on Android or iPhone?',
    a: 'Yes. The Resident Crew runs in any browser and can be installed directly as a fast Progressive Web App (PWA) from the home screen on Android or iOS.',
  },
  {
    q: 'How do I report a listing or safety concern?',
    a: 'Flag the listing inside the app or reach our team directly through the contact page.',
  },
]

export default function FaqPage() {
  const base = siteUrl()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${base}/faq#webpage`,
    url: `${base}/faq`,
    name: 'Frequently Asked Questions — The Resident Crew',
    isPartOf: { '@id': `${base}/#website` },
    publisher: { '@id': `${base}/#parent-org` },
    about: { '@id': `${base}/#app` },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', 'h3'],
    },
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'FAQ', href: '/faq' },
        ]}
      />
      <JsonLd data={jsonLd} />
      <h1>Frequently asked questions</h1>
      {faqs.map(f => (
        <section key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </section>
      ))}
      <p style={{ marginTop: '2rem' }}>
        Want to learn more about our leadership and ecosystem? Visit the <Link href="/founder">Founder profile</Link>,{' '}
        <Link href="/press">Press kit</Link>, or <Link href="/contact">Contact us</Link>.
      </p>
    </>
  )
}
