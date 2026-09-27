import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../../info.module.css'
import { siteUrl } from '../../../site-url'
import { listDirectory, areaLabel, distinct, SECTION_LABELS, type Section } from '../../../public-services'
import { Breadcrumbs, EntryList, JoinCta, JsonLd } from '../../directory-views'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

type Props = { params: Promise<{ area: string }> }

// Everything listed in one suburb. Only exists while the suburb has at
// least one public listing, so Google never sees an empty area page.
async function load(areaSlug: string) {
  const entries = (await listDirectory())
    .filter(e => e.areaSlug === areaSlug)
    .sort((a, b) => a.name.localeCompare(b.name))
  if (entries.length === 0) return null
  const name = areaLabel(entries, areaSlug) ?? areaSlug
  const city = entries.find(e => e.city)?.city ?? null
  return { areaSlug, name, city, entries }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load((await params).area)
  if (!d) return { title: 'Area not found — The Resident', robots: { index: false } }
  const cats = distinct(d.entries, e => e.category).slice(0, 4).join(', ').toLowerCase()
  return {
    title: `Local Services & Shops in ${d.name}${d.city ? `, ${d.city}` : ''} | The Resident`,
    description: `${d.entries.length} local ${d.entries.length === 1 ? 'listing' : 'listings'} in ${d.name}: ${cats}. Listed by residents on The Resident.`,
    alternates: { canonical: `/area/${d.areaSlug}` },
  }
}

export default async function AreaPage({ params }: Props) {
  const d = await load((await params).area)
  if (!d) notFound()
  const base = siteUrl()

  return (
    <>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Areas', href: '/area' },
          { name: d.name, href: `/area/${d.areaSlug}` },
        ]}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: d.entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}${e.href}`, name: e.name })),
        }}
      />
      <h1>Local services and shops in {d.name}</h1>
      <p className={styles.lede}>
        {d.entries.length} {d.entries.length === 1 ? 'listing' : 'listings'} from residents
        {d.city && <> in {d.name}, {d.city}</>}.
      </p>

      {(['services', 'shops'] as Section[]).map(section => {
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
      })}

      <JoinCta text={`Live or work in ${d.name}?`} />
    </>
  )
}
