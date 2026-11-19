import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { Breadcrumbs, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'
import { infoLinks } from '../../info-links'
import {
  CAMPUSES,
  DEFAULT_AREAS,
  DEFAULT_SERVICE_CATEGORIES,
  VENDOR_KIND_LABELS,
  distinct,
  listDirectory,
} from '../../public-services'
import { listPublicListings } from '../../public-listings'
import { SA_TAXI_RANKS } from '../../../utils/taxiRoutes'
import { STATUTORY_WARDS } from '../../../utils/civicChessboard'

export const revalidate = 3600

export function generateMetadata(): Metadata {
  const base = siteUrl()
  return {
    title: 'Complete Sitemap & Directory Index | The Resident Crew',
    description:
      'Browse every public page, South African suburb, campus housing hub, minibus taxi rank, municipal ward, service category, shop category, and XML sitemap on The Resident Crew.',
    alternates: { canonical: '/sitemap' },
    openGraph: {
      type: 'website',
      title: 'Complete Sitemap & Directory Index | The Resident Crew',
      description:
        'Full URL directory and XML sitemaps for rooms to rent, safety alerts, taxi ranks, municipal wards, and local services across South Africa.',
      url: `${base}/sitemap`,
      siteName: 'The Resident Crew',
      locale: 'en_ZA',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'The Resident Crew Sitemap' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Complete Sitemap & Directory Index | The Resident Crew',
      description: 'Every public page, suburb, campus, taxi rank, ward, and service category on The Resident Crew.',
      images: ['/opengraph-image'],
    },
  }
}

export default async function HtmlSitemapPage() {
  const base = siteUrl()
  const [entries, roomListings] = await Promise.all([listDirectory(), listPublicListings()])

  const areasMap = new Map<string, string>()
  for (const a of DEFAULT_AREAS) areasMap.set(a.slug, `${a.name} (${a.city})`)
  for (const e of entries) {
    if (e.areaSlug && !areasMap.has(e.areaSlug)) {
      areasMap.set(e.areaSlug, [e.suburb, e.city].filter(Boolean).join(', ') || e.areaSlug)
    }
  }
  const allAreas = Array.from(areasMap.entries()).map(([slug, label]) => ({ slug, label }))

  const serviceCategories = Array.from(
    new Map([
      ...Object.entries(DEFAULT_SERVICE_CATEGORIES),
      ...distinct(entries.filter(e => e.section === 'services'), e => e.categorySlug).map(slug => [
        slug,
        entries.find(e => e.section === 'services' && e.categorySlug === slug)?.category ?? slug,
      ] as [string, string]),
    ]).entries()
  )

  const shopCategories = Array.from(
    new Map([
      ...Object.entries(VENDOR_KIND_LABELS),
      ...distinct(entries.filter(e => e.section === 'shops'), e => e.categorySlug).map(slug => [
        slug,
        entries.find(e => e.section === 'shops' && e.categorySlug === slug)?.category ?? slug,
      ] as [string, string]),
    ]).entries()
  )

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${base}/sitemap#webpage`,
    url: `${base}/sitemap`,
    name: 'The Resident Crew Complete Sitemap',
    description:
      'Complete HTML index of public pages, rooms, suburbs, university campuses, taxi ranks, municipal wards, and XML sitemaps.',
    isPartOf: { '@id': `${base}/#website` },
    publisher: { '@id': `${base}/#parent-org` },
  }

  return (
    <article>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Sitemap', href: '/sitemap' },
        ]}
      />
      <JsonLd data={jsonLd} />

      <h1>Complete App Sitemap</h1>
      <p className={styles.lede}>
        Every public route, suburb guide, university accommodation corridor, minibus taxi interchange, municipal ward,
        and service category on <strong>The Resident Crew</strong>.
      </p>

      <section aria-labelledby="xml-sitemaps-heading">
        <h2 id="xml-sitemaps-heading">Machine-Readable Sitemaps &amp; Crawler Endpoints</h2>
        <ul>
          <li><a href="/sitemap.xml">Primary XML Sitemap (<code>/sitemap.xml</code>)</a></li>
          <li><a href="/image-sitemap.xml">Google Image Sitemap (<code>/image-sitemap.xml</code>)</a></li>
          <li><a href="/robots.txt">Crawler Rules (<code>/robots.txt</code>)</a></li>
          <li><a href="/llms.txt">AI Engine Summary (<code>/llms.txt</code>)</a></li>
          <li><a href="/llms-full.txt">AI Engine Full Reference (<code>/llms-full.txt</code>)</a></li>
        </ul>
      </section>

      <section aria-labelledby="core-pages-heading">
        <h2 id="core-pages-heading">Core Pages &amp; Platform Hubs</h2>
        <ul>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/auth">Sign Up / Log In</Link></li>
          {infoLinks.map(link => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="campuses-heading">
        <h2 id="campuses-heading">University Student Accommodation Corridors ({CAMPUSES.length})</h2>
        <ul>
          <li><Link href="/campus">All University Campuses</Link></li>
          {CAMPUSES.map(c => (
            <li key={c.slug}>
              <Link href={`/campus/${c.slug}`}>{c.name}</Link> — {c.city}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading">South African Suburbs &amp; Precincts ({allAreas.length})</h2>
        <ul>
          <li><Link href="/area">All Suburbs Directory</Link></li>
          {allAreas.map(a => (
            <li key={a.slug}>
              <Link href={`/area/${a.slug}`}>{a.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="taxi-ranks-heading">
        <h2 id="taxi-ranks-heading">Minibus Taxi Ranks &amp; Fare Guides ({SA_TAXI_RANKS.length})</h2>
        <ul>
          <li><Link href="/taxi-ranks">All Taxi Ranks &amp; Hand Signals</Link></li>
          {SA_TAXI_RANKS.map(rank => (
            <li key={rank.id}>
              <Link href={`/taxi-ranks/${rank.id}`}>{rank.name}</Link> — {rank.city}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="wards-heading">
        <h2 id="wards-heading">Municipal Wards &amp; SLA Infrastructure ({STATUTORY_WARDS.length})</h2>
        <ul>
          <li><Link href="/wards">All Municipal Wards</Link></li>
          {STATUTORY_WARDS.map(w => (
            <li key={w.wardCode}>
              <Link href={`/wards/${w.wardCode.toLowerCase()}`}>
                Ward {w.wardNumber} — {w.suburb}
              </Link>{' '}
              ({w.municipality})
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="services-heading">
        <h2 id="services-heading">Local Services Categories ({serviceCategories.length})</h2>
        <ul>
          <li><Link href="/services">All Local Services</Link></li>
          {serviceCategories.map(([slug, label]) => (
            <li key={slug}>
              <Link href={`/services/${slug}`}>{label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="shops-heading">
        <h2 id="shops-heading">Local Shops &amp; Spaza Categories ({shopCategories.length})</h2>
        <ul>
          <li><Link href="/shops">All Local Shops</Link></li>
          {shopCategories.map(([kind, label]) => (
            <li key={kind}>
              <Link href={`/shops/${kind}`}>{label}</Link>
            </li>
          ))}
        </ul>
      </section>

      {roomListings.length > 0 && (
        <section aria-labelledby="rooms-heading">
          <h2 id="rooms-heading">Public Room Listings ({roomListings.length})</h2>
          <ul>
            {roomListings.map(r => (
              <li key={r.id}>
                <Link href={`/rooms/${r.id}`}>{r.title}</Link>
                {(r.suburb || r.city) && <> — {[r.suburb, r.city].filter(Boolean).join(', ')}</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {entries.length > 0 && (
        <section aria-labelledby="listings-heading">
          <h2 id="listings-heading">Public Services &amp; Shops Listings ({entries.length})</h2>
          <ul>
            {entries.map(e => (
              <li key={e.id}>
                <Link href={e.href}>{e.name}</Link> — {e.category}
                {e.suburb ? ` (${e.suburb})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
