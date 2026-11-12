import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { listPublicVendors, vendorSlug, servicePlace, VENDOR_KIND_LABELS } from '../../public-services'
import { Breadcrumbs, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

export const metadata: Metadata = {
  title: 'Spaza Shops & Local Vendors Near You — The Resident',
  description:
    'Spaza shops, takeaways, fruit & veg stalls, airtime and gas sellers in your suburb, listed by the people who run them on The Resident.',
  alternates: { canonical: '/shops' },
  openGraph: {
    title: 'Spaza Shops & Local Vendors Near You — The Resident',
    description:
      'Spaza shops, takeaways, fruit & veg stalls, airtime and gas sellers in your suburb, listed by the people who run them on The Resident.',
    url: `${siteUrl()}/shops`,
  },
}

export default async function ShopsDirectory() {
  const vendors = await listPublicVendors()

  const byKind = new Map<string, typeof vendors>()
  for (const v of vendors) {
    const list = byKind.get(v.kind) ?? []
    list.push(v)
    byKind.set(v.kind, list)
  }
  const kinds = [...byKind.keys()].sort()

  const base = siteUrl()
  const shopsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Local Spaza Shops & Street Vendors in South Africa',
    description:
      'Spaza shops, takeaways, fruit & veg stalls, airtime and gas sellers in South African suburbs.',
    url: `${base}/shops`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: kinds.map((kind, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: VENDOR_KIND_LABELS[kind] ?? kind,
        url: `${base}/shops/${kind}`,
      })),
    },
  }

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Local shops', href: '/shops' },
        ]}
      />
      <JsonLd data={shopsJsonLd} />
      <h1>Local shops</h1>
      <p className={styles.lede}>
        Spaza shops and neighbourhood vendors, listed by the people who run them.
      </p>

      {vendors.length === 0 ? (
        <div className={styles.cta}>
          <p>No public listings yet.</p>
          <p style={{ marginBottom: 0 }}>
            Run a spaza or stall? <Link href="/auth">Join The Resident</Link> and register it — you choose whether it appears here.
          </p>
        </div>
      ) : (
        kinds.map(kind => (
          <section key={kind}>
            <h2><Link href={`/shops/${kind}`} style={{ color: 'inherit', textDecoration: 'none' }}>{VENDOR_KIND_LABELS[kind] ?? kind}</Link></h2>
            <ul>
              {byKind.get(kind)!.map(v => (
                <li key={v.id}>
                  <Link href={`/shops/${vendorSlug(v)}`}>{v.name}</Link>
                  {servicePlace(v) && <> — {servicePlace(v)}</>}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
