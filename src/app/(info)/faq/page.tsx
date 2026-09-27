import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ — The Resident',
  description:
    'Answers to common questions about The Resident: cost, who can join, safety, privacy, listing a business, and installing the app.',
  alternates: { canonical: '/faq' },
}

const faqs: { q: string; a: string }[] = [
  {
    q: 'What is The Resident?',
    a: 'A community app for neighbourhoods. Residents use it to find local services, buy and sell, find rooms, share lifts and tools, and send safety alerts.',
  },
  {
    q: 'Who can join?',
    a: 'Anyone who lives in, rents in, owns property in or regularly visits a suburb. You choose whether you are a tenant, landlord or visitor when you sign up.',
  },
  {
    q: 'How do I sign up?',
    a: 'Go to the sign-up page and register with your email address or Facebook, then choose your suburb.',
  },
  {
    q: 'Can I list my business or services?',
    a: 'Yes. Once you have an account, you can add your services so neighbours can find and contact you.',
  },
  {
    q: 'How do ratings work?',
    a: 'After you deal with a neighbour, you can rate them. Ratings add up to a reputation that others can see before they hire, buy from or share a home with someone.',
  },
  {
    q: 'Is my personal information public?',
    a: 'No. Messages, safety alerts, your trust circle and your personal profile are only visible to signed-in members, according to each feature’s settings. See our privacy policy for details.',
  },
  {
    q: 'How do safety alerts work?',
    a: 'You can send an alert to your community when you need help. Neighbours who have joined your suburb are notified. Alerts do not replace emergency services — in an emergency, call 10111 or 112.',
  },
  {
    q: 'Can I use it on my phone?',
    a: 'Yes. It works in any mobile browser, and you can install it on Android or add it to your iPhone home screen from our home page.',
  },
  {
    q: 'How do I report a problem or a person?',
    a: 'Use the contact page to get in touch with us.',
  },
]

export default function FaqPage() {
  // FAQPage structured data lets Google show these answers directly in results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <h1>Frequently asked questions</h1>
      {faqs.map(f => (
        <section key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </section>
      ))}
      <p style={{ marginTop: '2rem' }}>
        Still stuck? <Link href="/contact">Contact us</Link>.
      </p>
    </>
  )
}
