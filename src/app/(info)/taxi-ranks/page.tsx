import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { Breadcrumbs, JoinCta, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'
import { SA_TAXI_RANKS, getTaxiHandSignalGuide } from '../../../utils/taxiRoutes'

export const revalidate = 3600

const base = siteUrl()

export const metadata: Metadata = {
  title: 'South African Minibus Taxi Ranks, Routes, Fares & Hand Signals | The Resident Crew',
  description:
    'A guide to major South African taxi ranks (MTN Noord, Bree Street, Baragwanath, Bloed Street, Cape Town Station Deck, Warwick Junction), rough ZAR fares, operating hours, and commuter hand signals.',
  keywords: [
    'South Africa taxi ranks directory',
    'MTN Noord taxi rank routes and fares',
    'Bree street taxi rank destinations',
    'Baragwanath taxi rank Soweto fares',
    'South African taxi hand signals guide',
    'Bloed Street taxi rank Pretoria',
    'Cape Town Station Deck taxi routes',
    'Warwick Junction Durban taxi fares',
    'The Resident Crew transit radar',
  ],
  alternates: { canonical: '/taxi-ranks' },
  openGraph: {
    type: 'website',
    title: 'South African Minibus Taxi Ranks, Routes, Fares & Hand Signals | The Resident Crew',
    description:
      'Structured routes, ZAR taxi fares, platform bays, association hours, and South African commuter hand signals across Johannesburg, Pretoria, Cape Town, and Durban.',
    url: `${base}/taxi-ranks`,
    siteName: 'The Resident Crew',
    locale: 'en_ZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'South African Minibus Taxi Ranks & Fares — The Resident Crew' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'South African Minibus Taxi Ranks, Routes & Hand Signals | The Resident Crew',
    description:
      'Rough ZAR minibus taxi fares, operating hours, platform bays, and hand signals across JHB, PTA, CPT, and DUR.',
    images: ['/opengraph-image'],
  },
}

const taxiFaqs = [
  {
    q: 'What time do major South African taxi ranks open and close?',
    a: 'Major metropolitan interchanges like Bree Street and Baragwanath open around 04:00, MTN Noord, Bloed Street, and Warwick Junction open at 04:30, and Station Deck Cape Town opens at 05:00, operating through 21:30–22:30 daily.',
  },
  {
    q: 'How do South African minibus taxi hand signals work?',
    a: 'Standing beside the road, commuters use recognized hand signals to tell passing taxi drivers their destination before stopping: pointing an index finger downward signals Local / Short Left (within 1–3 km), pointing upward signals central CBD, and route-specific signs indicate Soweto, Sandton, Fourways, Alexandra, Khayelitsha, or Umlazi.',
  },
  {
    q: 'How does The Resident Crew help front-seat commuters and daily riders?',
    a: 'Inside The Resident Crew app, commuters can see rank routes and rough fares, check road-closure reports from neighbours, and use the built-in Front-Seat Change Calculator. Fares change, so confirm at the rank.',
  },
]

export default function TaxiRanksDirectoryPage() {
  const currentBase = siteUrl()
  const pageUrl = `${currentBase}/taxi-ranks`
  const handSignals = getTaxiHandSignalGuide()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'South African Minibus Taxi Ranks, Routes, Fares & Hand Signals',
        description:
          'Comprehensive public transit directory for minibus taxi interchanges, fares, platform bays, and hand signals across South Africa.',
        isPartOf: { '@id': `${currentBase}/#website` },
        publisher: { '@id': `${currentBase}/#parent-org` },
        about: { '@id': `${currentBase}/#app` },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', `.${styles.lede}`, 'h2'],
        },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: SA_TAXI_RANKS.map((rank, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${currentBase}/taxi-ranks/${rank.id}`,
            item: {
              '@type': 'BusStation',
              name: rank.name,
              alternateName: rank.popularName,
              address: {
                '@type': 'PostalAddress',
                streetAddress: rank.address,
                addressLocality: rank.metroHub,
                addressCountry: 'ZA',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: rank.lat,
                longitude: rank.lon,
              },
            },
          })),
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: taxiFaqs.map(f => ({
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
          { name: 'Taxi ranks & fares', href: '/taxi-ranks' },
        ]}
      />
      <JsonLd data={jsonLd} />

      <h1>South African minibus taxi ranks, fares &amp; hand signals</h1>
      <p className={styles.lede}>
        Rank locations, operating hours, corridors, platform bays, rough ZAR fares, and commuter hand signals across Johannesburg, Pretoria, Cape Town, and Durban. A rough guide: fares and bays change, so confirm at the rank.
      </p>

      <section>
        <h2>Major Metropolitan Taxi Interchanges</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
          {SA_TAXI_RANKS.map(rank => (
            <section
              key={rank.id}
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg)',
                margin: 0,
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                <Link href={`/taxi-ranks/${rank.id}`}>{rank.name}</Link>{' '}
                <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>({rank.city} · {rank.popularName})</span>
              </h3>
              <p style={{ margin: '4px 0', fontSize: '0.92rem' }}>
                <strong>Address:</strong> {rank.address} · <strong>Hours:</strong> {rank.operatingHours.opensAt} – {rank.operatingHours.closesAt}
              </p>
              <p style={{ margin: '4px 0 8px', fontSize: '0.9rem', opacity: 0.85 }}>
                <strong>Association:</strong> {rank.association} ({rank.associationCode})
              </p>
              <ul style={{ marginBottom: 0 }}>
                {rank.routes.map(route => (
                  <li key={route.id}>
                    <strong>{route.destination}</strong> — R{route.fareZAR} · ~{route.travelTimeMins} min · {route.platformBay} ({route.handSignal.gesture} {route.handSignal.name})
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section>
        <h2>South African Minibus Taxi Hand Signals Guide</h2>
        <p>Standard roadside hand signals used by commuters to hail passing minibus taxis by destination corridor:</p>
        <ul>
          {handSignals.map(sig => (
            <li key={sig.signalName}>
              {sig.gestureEmoji} <strong>{sig.signalName}</strong> ({sig.region}): {sig.meaning}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Commuter Frequently Asked Questions</h2>
        {taxiFaqs.map(f => (
          <div key={f.q} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{f.q}</h3>
            <p style={{ marginTop: 0, opacity: 0.85 }}>{f.a}</p>
          </div>
        ))}
      </section>

      <JoinCta text="Want road-closure reports and alerts from people near you on your phone?" />
    </>
  )
}
