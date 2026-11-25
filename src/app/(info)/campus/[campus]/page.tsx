import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../../info.module.css'
import { siteUrl } from '../../../site-url'
import { CAMPUSES, listDirectory, slugify } from '../../../public-services'
import { listPublicListings, roomPrice } from '../../../public-listings'
import { Breadcrumbs, EntryList, JoinCta, JsonLd } from '../../directory-views'

export const revalidate = 3600

type Props = { params: Promise<{ campus: string }> }

export function generateStaticParams() {
  return CAMPUSES.map(c => ({ campus: c.slug }))
}

async function loadCampus(slug: string) {
  const campus = CAMPUSES.find(c => c.slug === slug)
  if (!campus) return null
  const [allRooms, allEntries] = await Promise.all([
    listPublicListings(),
    listDirectory(),
  ])
  const areaSlugSet = new Set<string>([
    campus.areaSlug,
    ...(campus.slug === 'uj-auckland-park' ? ['auckland-park', 'cottesloe'] : []),
  ])
  const matchedRooms = allRooms.filter(r => {
    const sub = r.suburb ? slugify(r.suburb) : ''
    const cit = r.city ? slugify(r.city) : ''
    return areaSlugSet.has(sub) || cit === slugify(campus.city)
  })
  const rooms = (matchedRooms.length > 0 ? matchedRooms : allRooms).slice(0, 12)
  const areaEntries = allEntries.filter(e => e.areaSlug && areaSlugSet.has(e.areaSlug))
  return { campus, matchedCount: matchedRooms.length, rooms, areaEntries }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await loadCampus((await params).campus)
  if (!d) return { title: 'Campus not found — The Resident', robots: { index: false } }
  const base = siteUrl()
  const title = `Student Accommodation near ${d.campus.name} — Rooms & Communes | The Resident Crew`
  const description = `${d.campus.desc} Browse zero-broker student rooms, shared apartments, and neighbour-rated services in ${d.campus.city}.`
  return {
    title,
    description,
    keywords: [
      `${d.campus.name} student accommodation`,
      `rooms near ${d.campus.name}`,
      `student communes ${d.campus.city}`,
      `student housing ${d.campus.city}`,
      `private rooms ${d.campus.city} zero broker`,
      'The Resident Crew',
    ],
    alternates: { canonical: `/campus/${d.campus.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${base}/campus/${d.campus.slug}`,
      siteName: 'The Resident Crew',
      locale: 'en_ZA',
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `Student Accommodation near ${d.campus.name}`,
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

export default async function CampusPage({ params }: Props) {
  const d = await loadCampus((await params).campus)
  if (!d) notFound()
  const base = siteUrl()
  const pageUrl = `${base}/campus/${d.campus.slug}`
  const shortName = d.campus.name.split('(')[0].trim()

  const campusFaqs = [
    {
      q: `How do students find rooms near ${d.campus.name} without paying agent fees?`,
      a: `The Resident Crew connects students directly with landlords and resident hosts in ${d.campus.city}, with zero broker commission or middleman markups.`,
    },
    {
      q: `What safety tools are available for students living near ${d.campus.name}?`,
      a: `Every member has access to the live neighbourhood safety radar, 5-second panic beacon, trust circle notifications, and local emergency telemetry in ${d.campus.city}.`,
    },
    {
      q: `Can students also find local services and shops near ${d.campus.name}?`,
      a: `Yes. Students can discover laundromats, Wi-Fi technicians, spaza shops, and reliable movers rated by residents in ${d.campus.city}.`,
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: `Student Accommodation near ${d.campus.name}`,
        description: d.campus.desc,
        isPartOf: { '@id': `${base}/#website` },
        publisher: { '@id': `${base}/#parent-org` },
        about: { '@id': `${base}/#app` },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['h1', `.${styles.lede}`],
        },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: d.rooms.map((r, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `${r.title} (${roomPrice(r)})`,
            url: `${base}/rooms/${r.id}`,
          })),
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: campusFaqs.map(f => ({
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
          { name: 'Student Accommodation', href: '/campus' },
          { name: d.campus.name, href: `/campus/${d.campus.slug}` },
        ]}
      />
      <JsonLd data={jsonLd} />
      <h1>Student Accommodation near {d.campus.name}</h1>
      <p className={styles.lede}>{d.campus.desc}</p>

      <section style={{ margin: '28px 0' }}>
        <h2>
          {d.matchedCount > 0
            ? `Available Rooms & Communes in ${d.campus.city}`
            : `Featured Rooms Across South Africa`}
        </h2>
        {d.rooms.length > 0 ? (
          <ul>
            {d.rooms.map(r => (
              <li key={r.id}>
                <Link href={`/rooms/${r.id}`}>{r.title}</Link> — <strong>{roomPrice(r)}</strong>
                {[r.suburb, r.city].filter(Boolean).length > 0 && (
                  <> in {[r.suburb, r.city].filter(Boolean).join(', ')}</>
                )}
                {r.wifi && <> (Wi-Fi ready)</>}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            New student rooms near {shortName} are added daily. <Link href="/rooms">Browse all open rooms</Link> or sign up for instant suburb alerts.
          </p>
        )}
      </section>

      <section style={{ margin: '32px 0' }}>
        <h2>Local Services & Essentials in {d.campus.city}</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
          Laundromats, internet setups, grocery stores, and handymen trusted by students and residents.
        </p>
        {d.areaEntries.length > 0 && <EntryList entries={d.areaEntries.slice(0, 10)} showCategory />}
        <p style={{ marginTop: 12 }}>
          <Link href={`/area/${d.campus.areaSlug}`} style={{ color: '#00f2ff', fontWeight: 700 }}>
            Browse local services in {shortName} →
          </Link>
        </p>
      </section>

      <section style={{ margin: '32px 0' }}>
        <h2>Frequently asked questions — {shortName}</h2>
        {campusFaqs.map(f => (
          <div key={f.q} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{f.q}</h3>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, marginTop: 0 }}>{f.a}</p>
          </div>
        ))}
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

      <section style={{ margin: '32px 0' }}>
        <h2>Other University Corridors</h2>
        <ul>
          {CAMPUSES.filter(c => c.slug !== d.campus.slug).map(c => (
            <li key={c.slug}>
              <Link href={`/campus/${c.slug}`}>{c.name}</Link> — {c.city}
            </li>
          ))}
        </ul>
      </section>

      <JoinCta text={`Listing student accommodation near ${d.campus.name}?`} />
    </>
  )
}
