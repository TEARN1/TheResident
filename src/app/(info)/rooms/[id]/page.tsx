import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../../info.module.css'
import { getPublicListing, roomImages, roomPrice } from '../../../public-listings'
import { listingShareText, whatsappShareUrl } from '../../../../utils/publicListings'
import { siteUrl } from '../../../site-url'
import TrackRoomView from './TrackRoomView'

export const revalidate = 300 // must be a literal; matches ROOM_REVALIDATE_SECONDS

type Props = { params: Promise<{ id: string }> }

const KIND: Record<string, string> = { rent: 'Room to rent', sale: 'Place for sale', guesthouse: 'Guest house stay' }

// The page a room shared on WhatsApp opens: readable without an account,
// with an Open Graph preview (photo, price, suburb) so the chat shows what
// the link is before anyone taps it. Rooms come and go, so it is kept out of
// search results; a filled or hidden room simply stops resolving.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const row = await getPublicListing(id)
  if (!row) return { title: 'Room no longer listed | The Resident', robots: { index: false } }
  const where = row.suburb || row.city
  const title = `${row.title} — ${roomPrice(row)}${where ? ` in ${where}` : ''}`
  const description =
    row.description?.slice(0, 155) ||
    `${KIND[row.listing_type || 'rent'] || 'Room'}${where ? ` in ${where}` : ''}, listed by its landlord on The Resident.`
  const image = roomImages(row)[0]
  return {
    title: `${title} | The Resident`,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/rooms/${row.id}` },
    openGraph: {
      title,
      description,
      url: `${siteUrl()}/rooms/${row.id}`,
      siteName: 'The Resident',
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
  }
}

export default async function RoomPage({ params }: Props) {
  const { id } = await params
  const row = await getPublicListing(id)
  if (!row) notFound()

  const images = roomImages(row)
  const place = [row.suburb, row.city].filter(Boolean).join(', ')
  const shareUrl = whatsappShareUrl(
    listingShareText(
      { title: row.title, price: Number(row.price) || 0, currency: row.currency || 'ZAR', suburb: row.suburb || undefined, listingType: row.listing_type || undefined },
      `${siteUrl()}/rooms/${row.id}`
    )
  )
  const openInApp = `/dashboard/housing?listing=${row.id}`
  const features = [
    row.wifi && 'WiFi',
    row.parking && 'Parking',
    row.bathroom && `${row.bathroom[0].toUpperCase()}${row.bathroom.slice(1)} bathroom`,
    row.landlord_lives_here && 'Landlord lives on the property',
  ].filter(Boolean) as string[]

  return (
    <>
      <TrackRoomView type={row.listing_type || 'rent'} />
      <p className={styles.updated}>{KIND[row.listing_type || 'rent'] || 'Room'}{place && <> · {place}</>}</p>
      <h1>{row.title}</h1>
      <p className={styles.lede}><strong>{roomPrice(row)}</strong></p>

      {row.flagged && (
        <p style={{ padding: '0.75rem 1rem', borderRadius: 12, border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5' }}>
          Neighbours have flagged this listing{row.flag_reason ? `: ${row.flag_reason}` : ''}. Be careful, and never pay before viewing.
        </p>
      )}

      {images.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem', margin: '1rem 0' }}>
          {images.slice(0, 4).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- landlord-uploaded URL from storage
            <img key={src} src={src} alt={i === 0 ? row.title : `${row.title}, photo ${i + 1}`} style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12 }} />
          ))}
        </div>
      )}

      {row.description && (
        <>
          <h2>About this place</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{row.description}</p>
        </>
      )}

      {features.length > 0 && (
        <>
          <h2>What you get</h2>
          <ul>{features.map(f => <li key={f}>{f}</li>)}</ul>
        </>
      )}

      <h2>Before you pay</h2>
      <ul>
        <li>View the room and meet the landlord in person before paying any deposit.</li>
        <li>On The Resident you can see how this price compares with the suburb and what past tenants said.</li>
        {row.last_verified_at && <li>The landlord last confirmed this listing on {new Date(row.last_verified_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.</li>}
      </ul>

      <div className={styles.cta}>
        <p><strong>Interested?</strong></p>
        <p>
          <Link href={openInApp}>Open it on The Resident</Link> to check the price, read tenant reviews and send the landlord a request. Browsing is free, no account needed to look.
        </p>
        <p style={{ marginBottom: 0 }}>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer">Share it on WhatsApp</a> with someone who is looking.
        </p>
      </div>
    </>
  )
}
