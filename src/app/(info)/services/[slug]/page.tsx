import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import styles from '../../info.module.css'
import { getPublicService, serviceSlug, servicePlace } from '../../../public-services'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getPublicService((await params).slug)
  if (!s) return { title: 'Service not found — The Resident', robots: { index: false } }
  const place = servicePlace(s)
  return {
    title: `${s.business_name} — ${s.category}${place ? ` in ${place}` : ''} | The Resident`,
    description:
      s.description?.slice(0, 155) ||
      `${s.business_name} offers ${s.category.toLowerCase()} services${place ? ` in ${place}` : ''}. Rated by residents on The Resident.`,
    alternates: { canonical: `/services/${serviceSlug(s)}` },
  }
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params
  const s = await getPublicService(slug)
  if (!s) notFound()
  // Renamed listings keep working: old links redirect to the current name.
  const canonical = serviceSlug(s)
  if (slug !== canonical) permanentRedirect(`/services/${canonical}`)

  const place = servicePlace(s)
  const reviews = s.reviews_count ?? 0

  // LocalBusiness structured data. Ratings are only included once real
  // reviews exist; Google penalises ratings with nothing behind them.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: s.business_name,
    description: s.description || undefined,
    image: s.image || undefined,
    url: s.website_url || undefined,
    priceRange: s.price_estimate || undefined,
    address: place
      ? { '@type': 'PostalAddress', addressLocality: s.suburb || s.city, addressRegion: s.city || undefined, addressCountry: 'ZA' }
      : undefined,
  }
  if (reviews > 0 && s.rating != null) {
    jsonLd.aggregateRating = { '@type': 'AggregateRating', ratingValue: s.rating, reviewCount: reviews }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <p className={styles.updated}>
        <Link href="/services">Local services</Link> › {s.category}
      </p>
      <h1>{s.business_name}</h1>
      <p className={styles.lede}>
        {s.category}{place && <> in {place}</>}
      </p>

      {s.image && (
        // eslint-disable-next-line @next/next/no-img-element -- owner-supplied URL from any host
        <img src={s.image} alt={s.business_name} style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12, margin: '1rem 0' }} />
      )}

      {s.description && (
        <>
          <h2>About</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{s.description}</p>
        </>
      )}

      <h2>Details</h2>
      <ul>
        {s.price_estimate && <li><strong>Price:</strong> {s.price_estimate}</li>}
        {reviews > 0 && s.rating != null && (
          <li><strong>Rating:</strong> {Number(s.rating).toFixed(1)} / 5 from {reviews} {reviews === 1 ? 'neighbour' : 'neighbours'}</li>
        )}
        {place && <li><strong>Area:</strong> {place}</li>}
        {s.website_url && /^https?:\/\//i.test(s.website_url) && (
          <li><strong>Website:</strong> <a href={s.website_url} rel="nofollow noopener" target="_blank">{s.website_url.replace(/^https?:\/\//i, '')}</a></li>
        )}
      </ul>

      <div className={styles.cta}>
        <p><strong>Want to hire {s.business_name}?</strong></p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/auth">Join The Resident</Link> to contact them, see reviews from your neighbours, and book directly.
        </p>
      </div>
    </>
  )
}
