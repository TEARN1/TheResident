import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import styles from '../../info.module.css'
import { getPublicVendor, vendorSlug, servicePlace, VENDOR_KIND_LABELS } from '../../../public-services'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await getPublicVendor((await params).slug)
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
      <p className={styles.updated}>
        <Link href="/shops">Local shops</Link> › {kind}
      </p>
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
            {place && <li><strong>Area:</strong> {place}</li>}
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
