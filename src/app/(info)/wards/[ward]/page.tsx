import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../../info.module.css'
import { Breadcrumbs, JoinCta, JsonLd } from '../../directory-views'
import { siteUrl } from '../../../site-url'
import { STATUTORY_WARDS, HEAVY_MUNICIPAL_DEPARTMENTS } from '../../../../utils/civicChessboard'
import { DEFAULT_AREAS, slugify } from '../../../public-services'

export const revalidate = 3600

type Props = { params: Promise<{ ward: string }> }

export function generateStaticParams() {
  return STATUTORY_WARDS.map(w => ({ ward: w.wardCode.toLowerCase() }))
}

function findWard(slug: string) {
  return STATUTORY_WARDS.find(w => w.wardCode.toLowerCase() === slug.toLowerCase()) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = findWard((await params).ward)
  if (!w) return { title: 'Ward not found — The Resident Crew', robots: { index: false } }
  const base = siteUrl()
  const title = `Ward ${w.wardNumber} (${w.suburb}) — Substations, Reservoirs & Council Info | The Resident Crew`
  const description = `Infrastructure & ward profile for Ward ${w.wardNumber} (${w.suburb}) in ${w.municipality}: substations (${w.substations.join(', ')}), reservoirs (${w.reservoirs.join(', ')}), intersections, and SLA contacts.`

  return {
    title,
    description,
    keywords: [
      `Ward ${w.wardNumber} ${w.suburb}`,
      w.wardCode,
      ...w.substations,
      ...w.reservoirs,
      w.municipality,
      'The Resident Crew',
    ],
    alternates: { canonical: `/wards/${w.wardCode.toLowerCase()}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${base}/wards/${w.wardCode.toLowerCase()}`,
      siteName: 'The Resident Crew',
      locale: 'en_ZA',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `Ward ${w.wardNumber} — ${w.suburb}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
  }
}

export default async function WardDetailPage({ params }: Props) {
  const w = findWard((await params).ward)
  if (!w) notFound()
  const base = siteUrl()
  const slug = w.wardCode.toLowerCase()
  const pageUrl = `${base}/wards/${slug}`
  const departments = Object.values(HEAVY_MUNICIPAL_DEPARTMENTS)
  const matchedArea = DEFAULT_AREAS.find(a => a.slug === slugify(w.metroHub))

  const faqs = [
    {
      q: `Which substations and water reservoirs supply Ward ${w.wardNumber} (${w.suburb})?`,
      a: `Ward ${w.wardNumber} infrastructure includes electrical substations (${w.substations.join(', ')}) and bulk water reservoirs (${w.reservoirs.join(', ')}) within ${w.municipality}.`,
    },
    {
      q: `Where is the Ward ${w.wardNumber} office located and how are SLA breaches handled?`,
      a: `The ward office sits at ${w.councillor.officeAddress}. Under The Resident Crew SLA ledger and Chapter 4 of the Municipal Systems Act, unresolved faults escalate to Executive Mayor and Provincial tiers.`,
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: `Ward ${w.wardNumber} (${w.suburb}) — ${w.municipality}`,
        isPartOf: { '@id': `${base}/#website` },
        publisher: { '@id': `${base}/#parent-org` },
        about: { '@id': `${pageUrl}#area` },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', `.${styles.lede}`],
        },
      },
      {
        '@type': 'AdministrativeArea',
        '@id': `${pageUrl}#area`,
        name: `Ward ${w.wardNumber} (${w.suburb})`,
        description: `Electoral ward ${w.wardCode} within ${w.municipality}, ${w.province}.`,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: w.center.lat,
          longitude: w.center.lon,
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: faqs.map(f => ({
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
          { name: 'Municipal wards', href: '/wards' },
          { name: `Ward ${w.wardNumber}`, href: `/wards/${slug}` },
        ]}
      />
      <JsonLd data={jsonLd} />

      <h1>Ward {w.wardNumber} — {w.suburb}</h1>
      <p className={styles.lede}>
        {w.municipality} ({w.province}) · Precinct Hub: {w.metroHub} · Ward Code: {w.wardCode}.
      </p>

      <section>
        <h2>Ward Office &amp; Representation</h2>
        <ul>
          <li><strong>Ward Representative:</strong> {w.councillor.name}</li>
          <li><strong>Civic Office:</strong> {w.councillor.officeAddress}</li>
          <li><strong>Contact Email:</strong> {w.councillor.email}</li>
          {matchedArea && (
            <li>
              <strong>Local Community Directory:</strong>{' '}
              <Link href={`/area/${matchedArea.slug}`}>Rooms, plumbers &amp; spaza shops in {matchedArea.name}</Link>
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2>Power Substations, Water Reservoirs &amp; Key Intersections</h2>
        <ul>
          <li><strong>Substations Monitored:</strong> {w.substations.join(', ')}</li>
          <li><strong>Bulk Water Reservoirs:</strong> {w.reservoirs.join(', ')}</li>
          <li><strong>Priority Traffic Signal Intersections:</strong> {w.majorIntersections.join(' · ')}</li>
        </ul>
      </section>

      <section>
        <h2>Municipal SLA Targets Applicable to Ward {w.wardNumber}</h2>
        <ul>
          {departments.map(dept => (
            <li key={dept.key}>
              <strong>{dept.agency}:</strong> Critical fault SLA {dept.slaHoursCritical}h · Standard fault SLA {dept.slaHoursStandard}h (Dispatch: {dept.dispatchContact})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Frequently Asked Questions — Ward {w.wardNumber}</h2>
        {faqs.map(f => (
          <div key={f.q} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{f.q}</h3>
            <p style={{ marginTop: 0, opacity: 0.85 }}>{f.a}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Other Municipal Wards</h2>
        <ul>
          {STATUTORY_WARDS.filter(item => item.wardCode !== w.wardCode).map(item => (
            <li key={item.wardCode}>
              <Link href={`/wards/${item.wardCode.toLowerCase()}`}>Ward {item.wardNumber} — {item.suburb}</Link> ({item.municipality})
            </li>
          ))}
        </ul>
      </section>

      <JoinCta text={`Live or work in Ward ${w.wardNumber} (${w.metroHub})?`} />
    </>
  )
}
