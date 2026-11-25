import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { Breadcrumbs, JoinCta, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'
import { listPublicListings, roomPrice } from '../../public-listings'
import { CAMPUSES, DEFAULT_AREAS, slugify } from '../../public-services'

export const revalidate = 300

const base = siteUrl()

export const metadata: Metadata = {
  title: 'Rooms to Rent in South Africa — Zero Broker Fees | The Resident Crew',
  description:
    'Browse rooms, cottages, communes, and flatshares directly from South African landlords in Braamfontein, Soweto, Hatfield, Rondebosch, and Durban — zero agent fees.',
  keywords: [
    'rooms to rent South Africa',
    'rooms to rent Johannesburg no agent fees',
    'student rooms Braamfontein Auckland Park',
    'cottages to rent Soweto Pretoria',
    'zero broker rooms South Africa',
    'Rental Housing Act deposit check',
    'The Resident Crew rooms',
  ],
  alternates: { canonical: '/rooms' },
  openGraph: {
    type: 'website',
    title: 'Rooms to Rent in South Africa — Zero Broker Fees | The Resident Crew',
    description:
      'Browse rooms, cottages, communes, and flatshares directly from South African landlords with zero broker markups and fair-price checks.',
    url: `${base}/rooms`,
    siteName: 'The Resident Crew',
    locale: 'en_ZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Rooms to Rent — The Resident Crew' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rooms to Rent in South Africa — Zero Broker Fees | The Resident Crew',
    description:
      'Zero-broker rooms, student communes, and cottages directly from landlords across South Africa.',
    images: ['/opengraph-image'],
  },
}

const roomFaqs = [
  {
    q: 'Are there agent or broker fees on rooms listed on The Resident Crew?',
    a: 'No. Every room listing connects tenants directly with the landlord or property host, keeping monthly rent and deposits transparent with zero broker fees.',
  },
  {
    q: 'What protections apply to rental deposits in South Africa?',
    a: 'Under South Africa’s Rental Housing Act, deposits must be held in an interest-bearing account, accompanied by incoming and outgoing joint inspections before deductions can be made.',
  },
  {
    q: 'How do I verify a room before paying any deposit?',
    a: 'Inspect the property in person, review suburb price benchmarks inside The Resident Crew, read neighbour feedback, and never transfer booking money before viewing.',
  },
]

export default async function RoomsDirectoryPage() {
  const listings = await listPublicListings()
  const currentBase = siteUrl()
  const pageUrl = `${currentBase}/rooms`

  const bySuburb = new Map<string, typeof listings>()
  for (const r of listings) {
    const label = [r.suburb, r.city].filter(Boolean).join(', ') || 'South Africa'
    const bucket = bySuburb.get(label) ?? []
    bucket.push(r)
    bySuburb.set(label, bucket)
  }
  const areas = [...bySuburb.keys()].sort((a, b) => a.localeCompare(b))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Rooms to Rent in South Africa — Zero Broker Fees',
        description:
          'Direct room rentals, student communes, backyard cottages, and shared apartments across South African suburbs.',
        isPartOf: { '@id': `${currentBase}/#website` },
        publisher: { '@id': `${currentBase}/#parent-org` },
        about: { '@id': `${currentBase}/#app` },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', `.${styles.lede}`],
        },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: listings.slice(0, 50).map((r, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `${r.title} — ${roomPrice(r)}`,
            url: `${currentBase}/rooms/${r.id}`,
          })),
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: roomFaqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Rooms to rent', href: '/rooms' },
        ]}
      />
      <JsonLd data={jsonLd} />

      <h1>Rooms to rent in South Africa</h1>
      <p className={styles.lede}>
        Zero-broker rooms, cottages, bachelor flats, and student communes listed directly by landlords, with a fair-price check against nearby rooms.
      </p>

      {listings.length === 0 ? (
        <section>
          <p>
            Public room listings refresh every 5 minutes as landlords opt in to Google Search visibility. Browse by{' '}
            <Link href="/campus">university corridor</Link> or <Link href="/area">suburb</Link>, or sign in to view all live rooms inside the app.
          </p>
        </section>
      ) : (
        areas.map(areaName => (
          <section key={areaName}>
            <h2>{areaName}</h2>
            <ul>
              {bySuburb.get(areaName)!.map(r => (
                <li key={r.id}>
                  <Link href={`/rooms/${r.id}`}>{r.title}</Link> — <strong>{roomPrice(r)}</strong>
                  {r.wifi && <> · Wi-Fi</>}
                  {r.parking && <> · Parking</>}
                  {r.suburb && slugify(r.suburb) && (
                    <> · <Link href={`/area/${slugify(r.suburb)}`}>Suburb guide</Link></>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section>
        <h2>Browse Student Accommodation by University</h2>
        <ul>
          {CAMPUSES.map(c => (
            <li key={c.slug}>
              <Link href={`/campus/${c.slug}`}>{c.name}</Link> — {c.city}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Browse Rooms &amp; Services by Suburb</h2>
        <p style={{ lineHeight: 1.8 }}>
          {DEFAULT_AREAS.map((a, idx) => (
            <span key={a.slug}>
              {idx > 0 && ' · '}
              <Link href={`/area/${a.slug}`}>{a.name}</Link>
            </span>
          ))}
        </p>
      </section>

      <section>
        <h2>Zero-Broker Housing &amp; Tenant Questions</h2>
        {roomFaqs.map(f => (
          <div key={f.q} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{f.q}</h3>
            <p style={{ marginTop: 0, opacity: 0.85 }}>{f.a}</p>
          </div>
        ))}
      </section>

      <JoinCta text="Have a room, cottage, or flat to rent without agent commission?" />
    </>
  )
}
