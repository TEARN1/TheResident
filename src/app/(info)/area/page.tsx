import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { listDirectory, areaLabel, distinct } from '../../public-services'
import { JoinCta } from '../directory-views'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

export const metadata: Metadata = {
  title: 'Browse by Area — Local Services & Shops | The Resident',
  description: 'Find local services and shops suburb by suburb, listed by the residents who run them.',
  alternates: { canonical: '/area' },
}

export default async function AreasIndex() {
  const entries = await listDirectory()
  const areas = distinct(entries, e => e.areaSlug)
    .map(slug => ({
      slug,
      name: areaLabel(entries, slug) ?? slug,
      city: entries.find(e => e.areaSlug === slug && e.city)?.city ?? null,
      count: entries.filter(e => e.areaSlug === slug).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <h1>Browse by area</h1>
      <p className={styles.lede}>Local services and shops, suburb by suburb.</p>
      {areas.length === 0 ? (
        <JoinCta text="No areas have public listings yet. Run a business?" />
      ) : (
        <ul>
          {areas.map(a => (
            <li key={a.slug}>
              <Link href={`/area/${a.slug}`}>{a.name}</Link>
              {a.city && <>, {a.city}</>} ({a.count} {a.count === 1 ? 'listing' : 'listings'})
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
