import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '../info.module.css'
import { listDirectory, areaLabel, distinct, DEFAULT_AREAS } from '../../public-services'
import { JoinCta } from '../directory-views'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

export const metadata: Metadata = {
  title: 'Browse by Area — Local Services & Shops | The Resident',
  description: 'Find local services and shops suburb by suburb across South Africa, listed by the residents who run them.',
  alternates: { canonical: '/area' },
}

export default async function AreasIndex() {
  const entries = await listDirectory()
  const dbAreas = distinct(entries, e => e.areaSlug)
  const allAreaSlugs = Array.from(new Set([...dbAreas, ...DEFAULT_AREAS.map(a => a.slug)])).filter((s): s is string => !!s)

  const areas = allAreaSlugs
    .map(slug => {
      const def = DEFAULT_AREAS.find(a => a.slug === slug)
      const count = entries.filter(e => e.areaSlug === slug).length
      return {
        slug,
        name: areaLabel(entries, slug) ?? def?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        city: entries.find(e => e.areaSlug === slug && e.city)?.city ?? def?.city ?? null,
        count,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <h1>Browse by area</h1>
      <p className={styles.lede}>Local services and shops, suburb by suburb.</p>
      <ul>
        {areas.map(a => (
          <li key={a.slug} style={{ marginBottom: 8 }}>
            <Link href={`/area/${a.slug}`}>{a.name}</Link>
            {a.city && <>, {a.city}</>} {a.count > 0 ? `(${a.count} ${a.count === 1 ? 'listing' : 'listings'})` : ''}
          </li>
        ))}
      </ul>
      <JoinCta text="Run a business in your community? List your services on The Resident." />
    </>
  )
}
