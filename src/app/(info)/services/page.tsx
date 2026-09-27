import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { listPublicServices, serviceSlug, servicePlace, slugify } from '../../public-services'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

export const metadata: Metadata = {
  title: 'Local Services & Trades Near You — The Resident',
  description:
    'Plumbers, electricians, cleaners, builders, movers and more, listed by residents and rated by their neighbours on The Resident.',
  alternates: { canonical: '/services' },
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

  return (
    <>
      <h1>Local services</h1>
      <p className={styles.lede}>
        Trades and services listed by residents and rated by the neighbours who used them.
      </p>

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
