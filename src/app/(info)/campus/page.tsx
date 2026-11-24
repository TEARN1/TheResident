import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { CAMPUSES } from '../../public-services'
import { Breadcrumbs, JoinCta, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Student Accommodation near Universities in South Africa | The Resident Crew',
  description: 'Find verified student rooms, communes, and private rentals near major South African universities: Wits, UJ, UP Hatfield, UCT, Stellenbosch, UKZN, and TUT.',
  keywords: [
    'student accommodation South Africa',
    'rooms near Wits Braamfontein',
    'UJ Auckland Park student rooms',
    'UP Hatfield student communes',
    'UCT Rondebosch digs and flats',
    'The Resident Crew',
  ],
  alternates: { canonical: '/campus' },
  openGraph: {
    type: 'website',
    title: 'Student Accommodation near Universities in South Africa | The Resident Crew',
    description: 'Find verified student rooms, communes, and private rentals near major South African universities: Wits, UJ, UP Hatfield, UCT, Stellenbosch, UKZN, and TUT.',
    url: `${siteUrl()}/campus`,
    siteName: 'The Resident Crew',
    locale: 'en_ZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Student Accommodation in South Africa — The Resident Crew' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Student Accommodation near Universities in South Africa | The Resident Crew',
    description: 'Find verified student rooms, communes, and private rentals near major South African universities.',
    images: ['/opengraph-image'],
  },
}

export default function CampusIndex() {
  const base = siteUrl()
  const campusJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${base}/campus#webpage`,
    name: 'Student Accommodation near Universities in South Africa',
    description: 'Find verified student rooms, communes, and private rentals near major South African universities: Wits, UJ, UP Hatfield, UCT, Stellenbosch, UKZN, and TUT.',
    url: `${base}/campus`,
    isPartOf: { '@id': `${base}/#website` },
    publisher: { '@id': `${base}/#parent-org` },
    about: { '@id': `${base}/#app` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: CAMPUSES.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        url: `${base}/campus/${c.slug}`,
        description: c.desc,
      })),
    },
  }

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Student Accommodation', href: '/campus' },
        ]}
      />
      <JsonLd data={campusJsonLd} />
      <h1>Student Accommodation by University</h1>
      <p className={styles.lede}>
        Verified student communes, rooms, and shared apartments near major campuses across South Africa.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CAMPUSES.map(c => (
          <li key={c.slug} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18 }}>
            <Link href={`/campus/${c.slug}`} style={{ fontSize: 18, fontWeight: 700, color: '#00f2ff', textDecoration: 'none' }}>
              {c.name}
            </Link>
            <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              {c.desc}
            </p>
          </li>
        ))}
      </ul>

      <JoinCta text="Have a room or student commune to rent near campus? List it on The Resident." />
    </>
  )
}
