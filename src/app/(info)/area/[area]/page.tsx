import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../../info.module.css'
import { siteUrl } from '../../../site-url'
import {
  listDirectory, areaLabel, distinct, DEFAULT_AREAS, SECTION_LABELS, CAMPUSES, slugify, type Section,
} from '../../../public-services'
import { listPublicListings, roomPrice } from '../../../public-listings'
import { Breadcrumbs, EntryList, JoinCta, JsonLd } from '../../directory-views'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

type Props = { params: Promise<{ area: string }> }

export function generateStaticParams() {
  return DEFAULT_AREAS.map(a => ({ area: a.slug }))
}

async function load(areaSlug: string) {
  const [allEntries, allRooms] = await Promise.all([
    listDirectory(),
    listPublicListings(),
  ])
  const entries = allEntries
    .filter(e => e.areaSlug === areaSlug)
    .sort((a, b) => a.name.localeCompare(b.name))
  const defaultArea = DEFAULT_AREAS.find(a => a.slug === areaSlug)
  if (entries.length === 0 && !defaultArea) return null
  const name = areaLabel(entries, areaSlug) ?? defaultArea?.name ?? areaSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const city = entries.find(e => e.city)?.city ?? defaultArea?.city ?? null
  const rooms = allRooms
    .filter(r => {
      const sub = r.suburb ? slugify(r.suburb) : ''
      const cit = r.city ? slugify(r.city) : ''
      return sub === areaSlug || (city ? cit === slugify(city) : false)
    })
    .slice(0, 12)
  const nearbyCampuses = CAMPUSES.filter(
    c => c.areaSlug === areaSlug || (city ? slugify(c.city) === slugify(city) : false),
  )
  const siblingAreas = city
    ? DEFAULT_AREAS.filter(a => a.slug !== areaSlug && slugify(a.city) === slugify(city))
    : []
  return { areaSlug, name, city, entries, rooms, nearbyCampuses, siblingAreas }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load((await params).area)
  if (!d) return { title: 'Area not found — The Resident', robots: { index: false } }
  const base = siteUrl()
  const cats = d.entries.length > 0
    ? distinct(d.entries, e => e.category).slice(0, 4).join(', ').toLowerCase()
    : 'handymen, plumbers, cleaning, tuckshops and rooms'
  const title = `Rooms, Local Services & Shops in ${d.name}${d.city ? `, ${d.city}` : ''} | The Resident Crew`
  const description = d.entries.length > 0 || d.rooms.length > 0
    ? `${d.entries.length} local services/shops and ${d.rooms.length} open rooms in ${d.name}: ${cats}. Listed by residents on The Resident Crew.`
    : `Discover rooms to rent, local plumbers, spaza shops, and neighbourhood safety updates in ${d.name}${d.city ? `, ${d.city}` : ''} on The Resident Crew.`
  return {
    title,
    description,
    keywords: [
      `rooms to rent in ${d.name}`,
      `local services in ${d.name}`,
      `plumbers in ${d.name}`,
      `spaza shops in ${d.name}`,
      `neighbourhood safety ${d.name}`,
      ...(d.city ? [`${d.city} community directory`] : []),
      'The Resident Crew',
    ],
    alternates: { canonical: `/area/${d.areaSlug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${base}/area/${d.areaSlug}`,
      siteName: 'The Resident Crew',
      locale: 'en_ZA',
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `${d.name} Local Directory & Rooms — The Resident Crew`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
  }
}

export default async function AreaPage({ params }: Props) {
  const d = await load((await params).area)
  if (!d) notFound()
  const base = siteUrl()
  const pageUrl = `${base}/area/${d.areaSlug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: `Rooms, Local Services & Shops in ${d.name}${d.city ? `, ${d.city}` : ''}`,
        isPartOf: { '@id': `${base}/#website` },
        publisher: { '@id': `${base}/#parent-org` },
        about: {
          '@type': 'Place',
          name: d.name,
          address: {
            '@type': 'PostalAddress',
            addressLocality: d.name,
            addressRegion: d.city || 'South Africa',
            addressCountry: 'ZA',
          },
        },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', `.${styles.lede}`],
        },
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#items`,
        itemListElement: [
          ...d.entries.map((e, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${base}${e.href}`,
            name: e.name,
          })),
          ...d.rooms.map((r, i) => ({
            '@type': 'ListItem',
            position: d.entries.length + i + 1,
            url: `${base}/rooms/${r.id}`,
            name: `${r.title} (${roomPrice(r)})`,
          })),
        ],
      },
    ],
  }

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Areas', href: '/area' },
          { name: d.name, href: `/area/${d.areaSlug}` },
        ]}
      />
      <JsonLd data={jsonLd} />
      <h1>Rooms, local services &amp; shops in {d.name}</h1>
      <p className={styles.lede}>
        {d.entries.length > 0
          ? `${d.entries.length} ${d.entries.length === 1 ? 'listing' : 'listings'} from residents${d.city ? ` in ${d.name}, ${d.city}` : ''}.`
          : `Community network and directory for residents, rooms, and local businesses in ${d.name}${d.city ? `, ${d.city}` : ''}.`}
      </p>

      {d.rooms.length > 0 ? (
        <section>
          <h2>Rooms to Rent in {d.name}{d.city ? ` & ${d.city}` : ''}</h2>
          <ul>
            {d.rooms.map(r => (
              <li key={r.id}>
                <Link href={`/rooms/${r.id}`}>{r.title}</Link> — <strong>{roomPrice(r)}</strong>
                {r.suburb && <> in {r.suburb}</>}
              </li>
            ))}
          </ul>
          <p><Link href="/rooms">Browse all open rooms →</Link></p>
        </section>
      ) : (
        <section>
          <h2>Rooms to Rent in {d.name}</h2>
          <p>
            Looking for a room, cottage, or flatshare in {d.name}? <Link href="/rooms">Browse all open rooms</Link> or join free for zero-broker alerts.
          </p>
        </section>
      )}

      {d.entries.length === 0 ? (
        <div style={{ padding: '16px 0 24px' }}>
          <p style={{ marginBottom: 16 }}>No service or shop listings in {d.name} yet. Run a local service, trade, or shop in {d.name}?</p>
          <JoinCta text={`Be the first to list a service in ${d.name}`} />
        </div>
      ) : (
        (['services', 'shops'] as Section[]).map(section => {
          const inSection = d.entries.filter(e => e.section === section)
          if (inSection.length === 0) return null
          return distinct(inSection, e => e.categorySlug).map(catSlug => {
            const inCat = inSection.filter(e => e.categorySlug === catSlug)
            return (
              <section key={`${section}-${catSlug}`}>
                <h2>
                  <Link href={`/${section}/${catSlug}/${d.areaSlug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {inCat[0].category} in {d.name}
                  </Link>
                </h2>
                <p className={styles.updated}>{SECTION_LABELS[section]}</p>
                <EntryList entries={inCat} />
              </section>
            )
          })
        })
      )}

      {d.nearbyCampuses.length > 0 && (
        <section>
          <h2>Nearby Universities &amp; Student Accommodation</h2>
          <ul>
            {d.nearbyCampuses.map(c => (
              <li key={c.slug}>
                <Link href={`/campus/${c.slug}`}>{c.name}</Link> — {c.desc}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.siblingAreas.length > 0 && (
        <section>
          <h2>Nearby Suburbs in {d.city}</h2>
          <ul>
            {d.siblingAreas.map(a => (
              <li key={a.slug}>
                <Link href={`/area/${a.slug}`}>{a.name}, {a.city}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.entries.length > 0 && <JoinCta text={`Live or work in ${d.name}?`} />}
    </>
  )
}
