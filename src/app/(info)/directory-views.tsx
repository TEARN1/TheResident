import type { Metadata } from 'next'
import Link from 'next/link'
import styles from './info.module.css'
import { siteUrl } from '../site-url'
import {
  listDirectory, areaLabel, distinct, SECTION_LABELS,
  type DirectoryEntry, type Section,
} from '../public-services'

// Shared pieces for the category (/services/plumbing), category-in-area
// (/services/plumbing/soweto) and area (/area/soweto) pages.

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

// Visible breadcrumb trail plus BreadcrumbList data, which Google shows in
// place of the raw URL in results.
export function Breadcrumbs({ trail }: { trail: { name: string; href: string }[] }) {
  const base = siteUrl()
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: trail.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: t.name,
            item: `${base}${t.href}`,
          })),
        }}
      />
      <p className={styles.updated}>
        {trail.map((t, i) => (
          <span key={t.href}>
            {i > 0 && ' › '}
            {i < trail.length - 1 ? <Link href={t.href}>{t.name}</Link> : t.name}
          </span>
        ))}
      </p>
    </>
  )
}

export function EntryList({ entries, showCategory }: { entries: DirectoryEntry[]; showCategory?: boolean }) {
  return (
    <ul>
      {entries.map(e => (
        <li key={e.id}>
          <Link href={e.href}>{e.name}</Link>
          {showCategory && <> — {e.category}</>}
          {!showCategory && e.suburb && <> — {[e.suburb, e.city].filter(Boolean).join(', ')}</>}
          {e.description && (
            <>
              <br />
              <span style={{ fontSize: '0.9rem', opacity: 0.75 }}>
                {e.description.length > 140 ? `${e.description.slice(0, 140).trimEnd()}…` : e.description}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function JoinCta({ text }: { text: string }) {
  return (
    <div className={styles.cta}>
      <p style={{ marginBottom: 0 }}>
        {text} <Link href="/auth">Join The Resident</Link> — it&apos;s free, and you choose whether your listing appears here.
      </p>
    </div>
  )
}

// ---- Category pages: /services/<category> and /services/<category>/<area> ----

export interface CategoryData {
  section: Section
  categorySlug: string
  category: string
  areaSlug?: string
  area?: string
  entries: DirectoryEntry[]
  // Areas that have listings in this category, for internal links.
  areas: { slug: string; name: string; count: number }[]
}

export async function loadCategory(section: Section, categorySlug: string, areaSlug?: string): Promise<CategoryData | null> {
  const all = (await listDirectory()).filter(e => e.section === section && e.categorySlug === categorySlug)
  if (all.length === 0) return null
  const entries = areaSlug ? all.filter(e => e.areaSlug === areaSlug) : all
  if (entries.length === 0) return null
  const areas = distinct(all, e => e.areaSlug).map(slug => ({
    slug,
    name: areaLabel(all, slug) ?? slug,
    count: all.filter(e => e.areaSlug === slug).length,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    section,
    categorySlug,
    category: all[0].category,
    areaSlug,
    area: areaSlug ? areaLabel(all, areaSlug) ?? undefined : undefined,
    entries: [...entries].sort((a, b) => a.name.localeCompare(b.name)),
    areas,
  }
}

export function categoryMetadata(d: CategoryData | null): Metadata {
  if (!d) return { title: 'Not found — The Resident', robots: { index: false } }
  const where = d.area ? ` in ${d.area}` : ''
  const n = d.entries.length
  const path = `/${d.section}/${d.categorySlug}${d.areaSlug ? `/${d.areaSlug}` : ''}`
  return {
    title: `${d.category}${where} — ${n} local ${n === 1 ? 'listing' : 'listings'} | The Resident`,
    description: `Find ${d.category.toLowerCase()}${where}: ${d.entries.slice(0, 3).map(e => e.name).join(', ')}${n > 3 ? ' and more' : ''}. Listed by residents on The Resident.`,
    alternates: { canonical: path },
  }
}

export function CategoryView({ d }: { d: CategoryData }) {
  const sectionHref = `/${d.section}`
  const categoryHref = `${sectionHref}/${d.categorySlug}`
  const trail = [
    { name: 'Home', href: '/' },
    { name: SECTION_LABELS[d.section], href: sectionHref },
    { name: d.category, href: categoryHref },
    ...(d.areaSlug && d.area ? [{ name: d.area, href: `${categoryHref}/${d.areaSlug}` }] : []),
  ]
  const base = siteUrl()
  return (
    <>
      <Breadcrumbs trail={trail} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: d.entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}${e.href}`, name: e.name })),
        }}
      />
      <h1>{d.category}{d.area && <> in {d.area}</>}</h1>
      <p className={styles.lede}>
        {d.entries.length} {d.entries.length === 1 ? 'listing' : 'listings'} from residents
        {d.area ? <> in {d.area}</> : ' across all areas'}.
      </p>

      <EntryList entries={d.entries} />

      {!d.areaSlug && d.areas.length > 1 && (
        <>
          <h2>{d.category} by area</h2>
          <ul>
            {d.areas.map(a => (
              <li key={a.slug}><Link href={`${categoryHref}/${a.slug}`}>{d.category} in {a.name}</Link> ({a.count})</li>
            ))}
          </ul>
        </>
      )}

      {d.areaSlug && (
        <p>
          See all <Link href={categoryHref}>{d.category.toLowerCase()}</Link>, or everything in{' '}
          <Link href={`/area/${d.areaSlug}`}>{d.area}</Link>.
        </p>
      )}

      <JoinCta text={`Offer ${d.category.toLowerCase()}${d.area ? ` in ${d.area}` : ''}?`} />
    </>
  )
}
