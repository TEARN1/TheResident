import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { listPublicVendors, vendorSlug, servicePlace, VENDOR_KIND_LABELS } from '../../public-services'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

export const metadata: Metadata = {
  title: 'Spaza Shops & Local Vendors Near You — The Resident',
  description:
    'Spaza shops, takeaways, fruit & veg stalls, airtime and gas sellers in your suburb, listed by the people who run them on The Resident.',
  alternates: { canonical: '/shops' },
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

  return (
    <>
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
            <h2>{VENDOR_KIND_LABELS[kind] ?? kind}</h2>
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
