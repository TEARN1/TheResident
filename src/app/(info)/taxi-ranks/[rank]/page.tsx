import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../../info.module.css'
import { Breadcrumbs, JoinCta, JsonLd } from '../../directory-views'
import { siteUrl } from '../../../site-url'
import { SA_TAXI_RANKS } from '../../../../utils/taxiRoutes'
import { DEFAULT_AREAS, slugify } from '../../../public-services'

export const revalidate = 3600

type Props = { params: Promise<{ rank: string }> }

export function generateStaticParams() {
  return SA_TAXI_RANKS.map(r => ({ rank: r.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rank: rankSlug } = await params
  const rank = SA_TAXI_RANKS.find(r => r.id === rankSlug)
  if (!rank) return { title: 'Taxi Rank not found — The Resident Crew', robots: { index: false } }
  const base = siteUrl()
  const title = `${rank.name} — Routes, ZAR Fares, Platform Bays & Hours | The Resident Crew`
  const dests = rank.routes.map(r => r.destination).join(', ')
  const description = `${rank.name} (${rank.popularName}) in ${rank.address}: routes to ${dests}. Open ${rank.operatingHours.opensAt}–${rank.operatingHours.closesAt} daily with fares, bays, and taxi hand signals.`

  return {
    title,
    description,
    keywords: [
      `${rank.name} taxi fares`,
      `${rank.popularName} routes`,
      ...rank.routes.map(r => `taxi fare ${rank.popularName} to ${r.destination}`),
      `${rank.metroHub} public transport`,
      'The Resident Crew',
    ],
    alternates: { canonical: `/taxi-ranks/${rank.id}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${base}/taxi-ranks/${rank.id}`,
      siteName: 'The Resident Crew',
      locale: 'en_ZA',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: rank.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
  }
}

export default async function TaxiRankDetailPage({ params }: Props) {
  const { rank: rankSlug } = await params
  const rank = SA_TAXI_RANKS.find(r => r.id === rankSlug)
  if (!rank) notFound()
  const base = siteUrl()
  const pageUrl = `${base}/taxi-ranks/${rank.id}`
  const hubArea = DEFAULT_AREAS.find(a => a.slug === slugify(rank.metroHub))

  const rankFaqs = [
    {
      q: `What are the operating hours for ${rank.name}?`,
      a: `${rank.name} (${rank.popularName}) operates daily from ${rank.operatingHours.opensAt} to ${rank.operatingHours.closesAt}, with peak morning departures between ${rank.operatingHours.peakMorning} and peak afternoon dispatches between ${rank.operatingHours.peakAfternoon}.`,
    },
    {
      q: `How much are taxi fares from ${rank.name}?`,
      a: `Rough route fares range from ${Math.min(...rank.routes.map(r => r.fareZAR))} ZAR to ${Math.max(...rank.routes.map(r => r.fareZAR))} ZAR across ${rank.routes.length} primary corridors including ${rank.routes.map(r => `${r.destination} (R${r.fareZAR})`).join(', ')}.`,
    },
    {
      q: `Which taxi association operates at ${rank.name}?`,
      a: `Operations at ${rank.name} are coordinated with ${rank.association} (${rank.associationCode}) at ${rank.address}.`,
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: `${rank.name} — Routes, Fares & Hours`,
        isPartOf: { '@id': `${base}/#website` },
        publisher: { '@id': `${base}/#parent-org` },
        about: { '@id': `${pageUrl}#station` },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', `.${styles.lede}`],
        },
      },
      {
        '@type': 'BusStation',
        '@id': `${pageUrl}#station`,
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
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: rank.operatingHours.opensAt,
          closes: rank.operatingHours.closesAt,
        },
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#routes`,
        name: `Taxi Routes from ${rank.name}`,
        itemListElement: rank.routes.map((route, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Service',
            name: `${rank.popularName} to ${route.destination}`,
            areaServed: route.waypointStops.join(', '),
            offers: {
              '@type': 'Offer',
              price: route.fareZAR,
              priceCurrency: 'ZAR',
            },
          },
        })),
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: rankFaqs.map(f => ({
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
          { name: rank.name, href: `/taxi-ranks/${rank.id}` },
        ]}
      />
      <JsonLd data={jsonLd} />

      <h1>{rank.name}</h1>
      <p className={styles.lede}>
        {rank.popularName} · {rank.address} · Open {rank.operatingHours.opensAt} – {rank.operatingHours.closesAt} daily.
      </p>

      <section>
        <h2>Rank Operations &amp; Dispatch Details</h2>
        <ul>
          <li><strong>City / Precinct Hub:</strong> {rank.city} ({rank.metroHub})</li>
          <li><strong>Operating Association:</strong> {rank.association} ({rank.associationCode})</li>
          <li><strong>Morning Peak:</strong> {rank.operatingHours.peakMorning}</li>
          <li><strong>Afternoon Peak:</strong> {rank.operatingHours.peakAfternoon}</li>
          {hubArea && (
            <li>
              <strong>Nearby Suburb Directory:</strong>{' '}
              <Link href={`/area/${hubArea.slug}`}>Rooms &amp; services in {hubArea.name}</Link>
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2>Routes, Fares, Platform Bays &amp; Hand Signals</h2>
        {rank.routes.map(route => (
          <div
            key={route.id}
            style={{
              padding: '16px',
              marginBottom: '14px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'var(--card-bg)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>
              {route.destination} — R{route.fareZAR} ({route.travelTimeMins} min)
            </h3>
            <ul style={{ marginBottom: 0 }}>
              <li><strong>Corridor:</strong> {route.corridor}</li>
              <li><strong>Platform Bay:</strong> {route.platformBay}</li>
              <li><strong>Frequency:</strong> Every {route.frequencyPeakMins} mins peak / {route.frequencyOffPeakMins} mins off-peak</li>
              <li><strong>Hand Signal ({route.handSignal.name}):</strong> {route.handSignal.gesture} {route.handSignal.description}</li>
              <li><strong>Stops along route:</strong> {route.waypointStops.join(' → ')}</li>
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2>Frequently Asked Questions — {rank.popularName}</h2>
        {rankFaqs.map(f => (
          <div key={f.q} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{f.q}</h3>
            <p style={{ marginTop: 0, opacity: 0.85 }}>{f.a}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Other South African Taxi Interchanges</h2>
        <ul>
          {SA_TAXI_RANKS.filter(r => r.id !== rank.id).map(r => (
            <li key={r.id}>
              <Link href={`/taxi-ranks/${r.id}`}>{r.name}</Link> — {r.city} ({r.routes.length} routes)
            </li>
          ))}
        </ul>
      </section>

      <JoinCta text={`Commuting daily via ${rank.popularName}?`} />
    </>
  )
}
