import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { Breadcrumbs, JoinCta, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'
import { STATUTORY_WARDS, HEAVY_MUNICIPAL_DEPARTMENTS } from '../../../utils/civicChessboard'

export const revalidate = 3600

const base = siteUrl()

export const metadata: Metadata = {
  title: 'South African Municipal Wards, Substations, Reservoirs & SLA Ledger | The Resident Crew',
  description:
    'Look up statutory municipal wards, substations, water reservoirs, ward councillor contacts, and infrastructure fault SLA timers for City Power, Joburg Water, JRA, JMPD, and Pikitup.',
  keywords: [
    'Johannesburg municipal wards lookup',
    'City Power substation fault SLA',
    'Joburg Water reservoir and fault escalation',
    'South Africa ward councillor directory',
    'traffic light outage loadshedding matrix',
    'The Resident Crew civic governance',
  ],
  alternates: { canonical: '/wards' },
  openGraph: {
    type: 'website',
    title: 'South African Municipal Wards, Substations & SLA Ledger | The Resident Crew',
    description:
      'Ward-level substations, bulk water reservoirs, traffic signal fault corridors, and statutory SLA response windows across South African metros.',
    url: `${base}/wards`,
    siteName: 'The Resident Crew',
    locale: 'en_ZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'South African Municipal Wards & Infrastructure Directory' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'South African Municipal Wards & Infrastructure SLA Ledger | The Resident Crew',
    description:
      'Explore ward substations, water reservoirs, and statutory municipal service SLAs across South Africa.',
    images: ['/opengraph-image'],
  },
}

const wardFaqs = [
  {
    q: 'How are municipal fault SLA timers tracked across wards?',
    a: 'Each department — City Power / Eskom (24h critical / 72h standard), Joburg Water (24h / 48h), JRA Roads & Signals (48h / 168h), JMPD/SAPS (1h / 12h), and Pikitup (72h / 168h) — has statutory turnaround benchmarks tracked publicly.',
  },
  {
    q: 'What is a Ward Delivery Confidence Index and Digital Petition Quorum?',
    a: 'Under Chapter 4 of the Municipal Systems Act (Act 32 of 2000), residents can log infrastructure faults and collect verified signatures inside their ward to escalate overdue water, power, or traffic signal failures.',
  },
]

export default function WardsDirectoryPage() {
  const currentBase = siteUrl()
  const pageUrl = `${currentBase}/wards`
  const departments = Object.values(HEAVY_MUNICIPAL_DEPARTMENTS)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'South African Municipal Wards, Substations & Infrastructure SLA Ledger',
        description:
          'Public directory of statutory wards, substations, reservoirs, major traffic intersections, and municipal fault SLAs.',
        isPartOf: { '@id': `${currentBase}/#website` },
        publisher: { '@id': `${currentBase}/#parent-org` },
        about: { '@id': `${currentBase}/#app` },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', `.${styles.lede}`],
        },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: STATUTORY_WARDS.map((w, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `Ward ${w.wardNumber} (${w.suburb}) — ${w.municipality}`,
            url: `${currentBase}/wards/${w.wardCode.toLowerCase()}`,
          })),
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: wardFaqs.map(f => ({
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
        ]}
      />
      <JsonLd data={jsonLd} />

      <h1>South African municipal wards &amp; infrastructure ledger</h1>
      <p className={styles.lede}>
        Statutory ward profiles, electrical substations, bulk water reservoirs, load-shedding traffic signal corridors, and official SLA escalation windows across South African metros.
      </p>

      <section>
        <h2>Covered Metropolitan Wards</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
          {STATUTORY_WARDS.map(w => (
            <section
              key={w.wardCode}
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg)',
                margin: 0,
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                <Link href={`/wards/${w.wardCode.toLowerCase()}`}>
                  Ward {w.wardNumber} — {w.suburb}
                </Link>
              </h3>
              <p style={{ margin: '4px 0', fontSize: '0.92rem' }}>
                <strong>Municipality:</strong> {w.municipality} ({w.province}) · <strong>Code:</strong> {w.wardCode}
              </p>
              <p style={{ margin: '4px 0', fontSize: '0.9rem', opacity: 0.85 }}>
                <strong>Substations:</strong> {w.substations.join(', ')} · <strong>Reservoirs:</strong> {w.reservoirs.join(', ')}
              </p>
            </section>
          ))}
        </div>
      </section>

      <section>
        <h2>Municipal Department SLA &amp; Statutory Frameworks</h2>
        <ul>
          {departments.map(dept => (
            <li key={dept.key}>
              <strong>{dept.agency}</strong> ({dept.name}): Critical SLA {dept.slaHoursCritical}h · Standard SLA {dept.slaHoursStandard}h · Dispatch {dept.dispatchContact} · {dept.statutoryAct}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Civic Governance Questions</h2>
        {wardFaqs.map(f => (
          <div key={f.q} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{f.q}</h3>
            <p style={{ marginTop: 0, opacity: 0.85 }}>{f.a}</p>
          </div>
        ))}
      </section>

      <JoinCta text="Want to track substation outages, water pressure alerts, and fault SLAs in your ward?" />
    </>
  )
}
