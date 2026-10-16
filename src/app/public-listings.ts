// Server-side read of one open room for the public /rooms/<id> share page,
// from the res_public_listings view (open, visible listings; no landlord id,
// street address or coordinates). Plain PostgREST with the anon key, like
// public-services.ts, so the page needs no session.

import { PUBLIC_LISTING_COLUMNS, type PublicListingRow } from '../utils/publicListings'

// Rooms fill up, so re-read more often than the directory pages do.
export const ROOM_REVALIDATE_SECONDS = 300

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getPublicListing(id: string): Promise<PublicListingRow | null> {
  if (!UUID_RE.test(id)) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/rest/v1/res_public_listings?select=${PUBLIC_LISTING_COLUMNS}&id=eq.${id}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: ROOM_REVALIDATE_SECONDS },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as PublicListingRow[]
    return rows[0] ?? null
  } catch {
    return null
  }
}

/** "R4 500/mo" style price for the page and its preview text. */
export function roomPrice(row: Pick<PublicListingRow, 'price' | 'currency' | 'listing_type'>): string {
  const amount = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: row.currency || 'ZAR', maximumFractionDigits: 0 }).format(Number(row.price) || 0)
  const per = row.listing_type === 'guesthouse' ? '/night' : row.listing_type === 'sale' ? '' : '/mo'
  return `${amount}${per}`
}

/** Only https images go into the page and its WhatsApp preview. */
export function roomImages(row: Pick<PublicListingRow, 'images'>): string[] {
  return (row.images || []).filter(u => typeof u === 'string' && /^https:\/\//i.test(u))
}
