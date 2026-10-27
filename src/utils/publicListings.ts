import type { Listing } from '../store'

/**
 * A row of the res_public_listings view: open, visible listings with only
 * the fields safe to show a logged-out visitor (no landlord id, street
 * address or coordinates). Guests browse these, and the public /rooms/<id>
 * share pages are built from them.
 */
export interface PublicListingRow {
  id: string
  title: string
  description: string | null
  price: number | string | null
  currency: string | null
  suburb: string | null
  city: string | null
  images: string[] | null
  wifi: boolean | null
  parking: boolean | null
  bathroom: string | null
  landlord_lives_here: boolean | null
  listing_type: string | null
  quick_post: boolean | null
  event_id: string | null
  featured_until: string | null
  last_verified_at: string | null
  flagged: boolean | null
  flag_reason: string | null
  created_at: string | null
}

export const PUBLIC_LISTING_COLUMNS =
  'id,title,description,price,currency,suburb,city,images,wifi,parking,bathroom,landlord_lives_here,listing_type,quick_post,event_id,featured_until,last_verified_at,flagged,flag_reason,created_at'

/** Map a public row onto the app's Listing shape. Fields the public view
 *  deliberately omits get neutral values, never invented ones. */
export function publicListingToListing(row: PublicListingRow): Listing {
  const place = [row.suburb, row.city].filter(Boolean).join(', ')
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    price: Number(row.price) || 0,
    currency: row.currency || 'ZAR',
    location: place,
    suburb: row.suburb || '',
    safetyRating: 'medium',
    safetyNotes: row.flagged && row.flag_reason ? row.flag_reason : '',
    landlordId: '',
    landlordName: '',
    landlordLivesHere: !!row.landlord_lives_here,
    images: row.images || [],
    amenities: {
      wifi: !!row.wifi,
      parking: !!row.parking,
      bathroom: (row.bathroom === 'private' || row.bathroom === 'ensuite' ? row.bathroom : 'shared')
    },
    requirements: {
      genderPreference: 'any',
      childrenAllowed: true,
      maxChildren: 0,
      smokingAllowed: false,
      petsAllowed: false
    },
    lastVerifiedAt: row.last_verified_at || undefined,
    featuredUntil: row.featured_until || null,
    createdAt: row.created_at || undefined,
    quickPost: !!row.quick_post,
    listingType: row.listing_type === 'sale' || row.listing_type === 'guesthouse' ? row.listing_type : 'rent',
    eventId: row.event_id || null
  }
}

/** Short, shareable summary, e.g. "Sunny room — R4,500/mo in Braamfontein". */
export function listingShareText(l: { title: string; price: number; currency: string; suburb?: string; listingType?: string }, url: string): string {
  const per = l.listingType === 'guesthouse' ? '/night' : l.listingType === 'sale' ? '' : '/mo'
  const amount = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: l.currency || 'ZAR', maximumFractionDigits: 0 }).format(l.price)
  const where = l.suburb ? ` in ${l.suburb}` : ''
  return `${l.title} — ${amount}${per}${where}. On The Resident: ${url}`
}

/** wa.me link that opens WhatsApp with the text ready to send. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
