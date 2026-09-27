import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import styles from '../../info.module.css'
import { getPublicVendor, vendorSlug, servicePlace, VENDOR_KIND_LABELS, isListingSlug, slugify } from '../../../public-services'
import { Breadcrumbs, CategoryView, categoryMetadata, loadCategory } from '../../directory-views'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

type Props = { params: Promise<{ slug: string }> }

// /shops/<slug> is either one shop (slug ends in its id) or a type such
// as /shops/spaza.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!isListingSlug(slug)) return categoryMetadata(await loadCategory('shops', slug))
  const v = await getPublicVendor(slug)
  if (!v) return { title: 'Shop not found — The Resident', robots: { index: false } }
  const place = servicePlace(v)
  const kind = VENDOR_KIND_LABELS[v.kind] ?? 'Local shop'
  return {
    title: `${v.name} — ${kind}${place ? ` in ${place}` : ''} | The Resident`,
    description:
      v.description?.slice(0, 155) ||
      `${v.name} is a ${kind.toLowerCase()}${place ? ` in ${place}` : ''}, listed on The Resident.`,
    alternates: { canonical: `/shops/${vendorSlug(v)}` },
  }
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params
  if (!isListingSlug(slug)) {
    const d = await loadCategory('shops', slug)
    if (!d) notFound()
    return <CategoryView d={d} />
  }
  const v = await getPublicVendor(slug)
  if (!v) notFound()
  const canonical = vendorSlug(v)
  if (slug !== canonical) permanentRedirect(`/shops/${canonical}`)

  const place = servicePlace(v)
  const kind = VENDOR_KIND_LABELS[v.kind] ?? 'Local shop'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': v.kind === 'food' ? 'FoodEstablishment' : 'Store',
    name: v.name,
    description: v.description || undefined,
    address: place
      ? { '@type': 'PostalAddress', addressLocality: v.suburb || v.city, addressRegion: v.city || undefined, addressCountry: 'ZA' }
      : undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Local shops', href: '/shops' },
          { name: kind, href: `/shops/${v.kind}` },
          { name: v.name, href: `/shops/${canonical}` },
        ]}
      />
      <h1>{v.name}</h1>
      <p className={styles.lede}>
        {kind}{place && <> in {place}</>}
      </p>

      {v.description && (
        <>
          <h2>About</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{v.description}</p>
        </>
      )}

      {(v.hours || place || (v.sells && v.sells.length > 0)) && (
        <>
          <h2>Details</h2>
          <ul>
            {v.hours && <li><strong>Hours:</strong> {v.hours}</li>}
            {place && (
              <li>
                <strong>Area:</strong>{' '}
                {v.suburb && slugify(v.suburb)
                  ? <Link href={`/area/${slugify(v.suburb)}`}>{place}</Link>
                  : place}
              </li>
            )}
            {v.sells && v.sells.length > 0 && <li><strong>Sells:</strong> {v.sells.join(', ')}</li>}
          </ul>
        </>
      )}

      <div className={styles.cta}>
        <p><strong>Want to find {v.name}?</strong></p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/auth">Join The Resident</Link> to get directions, contact the owner and see what your neighbours say.
        </p>
      </div>
    </>
  )
}
