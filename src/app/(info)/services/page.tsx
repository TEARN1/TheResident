import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { listPublicServices, serviceSlug, servicePlace, slugify, DEFAULT_SERVICE_CATEGORIES } from '../../public-services'
import { Breadcrumbs, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

export const metadata: Metadata = {
  title: 'Local Services & Trades Near You | The Resident Crew',
  description:
    'Plumbers, electricians, cleaners, builders, movers and more across South Africa, listed by residents and rated by their neighbours on The Resident Crew.',
  keywords: [
    'local plumbers South Africa',
    'electricians Soweto Johannesburg Pretoria',
    'neighbour rated handymen cleaners movers',
    'The Resident Crew local services',
  ],
  alternates: { canonical: '/services' },
  openGraph: {
    type: 'website',
    title: 'Local Services & Trades Near You | The Resident Crew',
    description:
      'Plumbers, electricians, cleaners, builders, movers and more, listed by residents and rated by neighbours.',
    url: `${siteUrl()}/services`,
    siteName: 'The Resident Crew',
    locale: 'en_ZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Local Services & Trades — The Resident Crew' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Services & Trades Near You | The Resident Crew',
    description:
      'Plumbers, electricians, cleaners, builders, movers and more, rated by neighbours on The Resident Crew.',
    images: ['/opengraph-image'],
  },
}

export default async function ServicesDirectory() {
  const services = await listPublicServices()

  // Group by category so the page reads as a directory, not one long list.
  const byCategory = new Map<string, typeof services>()
  for (const s of services) {
    const list = byCategory.get(s.category) ?? []
    list.push(s)
    byCategory.set(s.category, list)
  }
  const categories = [...byCategory.keys()].sort()

  const base = siteUrl()
  const servicesJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${base}/services#webpage`,
    name: 'Local Services & Trades in South Africa',
    description:
      'Plumbers, electricians, cleaners, builders, movers and more, listed by residents and rated by neighbours.',
    url: `${base}/services`,
    isPartOf: { '@id': `${base}/#website` },
    publisher: { '@id': `${base}/#parent-org` },
    about: { '@id': `${base}/#app` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: categories.map((cat, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: cat,
        url: `${base}/services/${slugify(cat)}`,
      })),
    },
  }

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Local services', href: '/services' },
        ]}
      />
      <JsonLd data={servicesJsonLd} />
      <h1>Local services</h1>
      <p className={styles.lede}>
        Trades and services listed by residents and rated by the neighbours who used them.
      </p>

      <section aria-labelledby="service-categories-heading">
        <h2 id="service-categories-heading">Browse by Service Category</h2>
        <ul>
          {Object.entries(DEFAULT_SERVICE_CATEGORIES).map(([slug, label]) => (
            <li key={slug}>
              <Link href={`/services/${slug}`}>{label}</Link>
            </li>
          ))}
        </ul>
      </section>

      {services.length === 0 ? (
        <div className={styles.cta}>
          <p>No public listings yet.</p>
          <p style={{ marginBottom: 0 }}>
            Run a local business? <Link href="/auth">Join The Resident</Link> and list it — you choose whether it appears here.
          </p>
        </div>
      ) : (
        categories.map(cat => (
          <section key={cat}>
            <h2><Link href={`/services/${slugify(cat)}`} style={{ color: 'inherit', textDecoration: 'none' }}>{cat}</Link></h2>
            <ul>
              {byCategory.get(cat)!.map(s => (
                <li key={s.id}>
                  <Link href={`/services/${serviceSlug(s)}`}>{s.business_name}</Link>
                  {servicePlace(s) && <> — {servicePlace(s)}</>}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
