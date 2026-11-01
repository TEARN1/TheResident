import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../../info.module.css'
import { siteUrl } from '../../../site-url'
import { CAMPUSES, listDirectory } from '../../../public-services'
import { listPublicListings } from '../../../public-listings'
import { Breadcrumbs, JoinCta, JsonLd } from '../../directory-views'

export const revalidate = 3600

type Props = { params: Promise<{ campus: string }> }

async function loadCampus(slug: string) {
  const campus = CAMPUSES.find(c => c.slug === slug)
  if (!campus) return null
  const [allRooms, allEntries] = await Promise.all([
    listPublicListings(),
    listDirectory(),
  ])
  const areaEntries = allEntries.filter(e => e.areaSlug === campus.areaSlug)
  return { campus, allRooms, areaEntries }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await loadCampus((await params).campus)
  if (!d) return { title: 'Campus not found — The Resident', robots: { index: false } }
  return {
    title: `Student Accommodation near ${d.campus.name} | The Resident`,
    description: d.campus.desc,
    alternates: { canonical: `/campus/${d.campus.slug}` },
  }
}

export default async function CampusPage({ params }: Props) {
  const d = await loadCampus((await params).campus)
  if (!d) notFound()
  const base = siteUrl()

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Student Accommodation', href: '/campus' },
          { name: d.campus.name, href: `/campus/${d.campus.slug}` },
        ]}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ApartmentComplex',
          name: `Student Accommodation near ${d.campus.name}`,
          description: d.campus.desc,
          address: {
            '@type': 'PostalAddress',
            addressLocality: d.campus.city,
            addressCountry: 'ZA',
          },
          url: `${base}/campus/${d.campus.slug}`,
        }}
      />
      <h1>Student Accommodation near {d.campus.name}</h1>
      <p className={styles.lede}>{d.campus.desc}</p>

      <section style={{ margin: '32px 0' }}>
        <h2>Local Services & Essentials in {d.campus.city}</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          Laundromats, internet setups, grocery stores, and handymen trusted by students and residents.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href={`/area/${d.campus.areaSlug}`} style={{ color: '#00f2ff', fontWeight: 700 }}>
            Browse local services in {d.campus.name.split('(')[0].trim()} →
          </Link>
        </p>
      </section>

      <section style={{ margin: '32px 0' }}>
        <h2>Weekend Events & Culture</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          Heading out after lectures? Discover upcoming weekend music sessions, soundstages, and food markets across {d.campus.city} on The Gruvs.
        </p>
        <p style={{ marginTop: 12 }}>
          <a
            href={`https://thegruvs.com/events/${d.campus.areaSlug}`}
            target="_blank"
            rel="noopener"
            style={{ color: '#00f2ff', fontWeight: 700 }}
          >
            Explore upcoming events in {d.campus.city} on The Gruvs →
          </a>
        </p>
      </section>

      <JoinCta text={`Listing student accommodation near ${d.campus.name}?`} />
    </>
  )
}
