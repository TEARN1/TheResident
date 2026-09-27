// Server-side reads of the public service directory (the res_public_services
// view, which only holds listings whose owners chose "Show on Google").
// Plain PostgREST fetches with the anon key, so no session or cookies are
// involved and the pages can be cached.

export interface PublicService {
  id: string
  business_name: string
  category: string
  suburb: string | null
  city: string | null
  description: string | null
  price_estimate: string | null
  website_url: string | null
  image: string | null
  rating: number | null
  reviews_count: number | null
  updated_at: string | null
}

// Pages re-read the database at most once an hour.
export const REVALIDATE_SECONDS = 3600

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function query(params: string): Promise<PublicService[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const res = await fetch(`${url}/rest/v1/res_public_services?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return []
    return (await res.json()) as PublicService[]
  } catch {
    return []
  }
}

export function listPublicServices(): Promise<PublicService[]> {
  return query('select=*&order=business_name.asc&limit=5000')
}

export async function getPublicService(slug: string): Promise<PublicService | null> {
  const id = slug.match(UUID_RE)?.[0]
  if (!id) return null
  const rows = await query(`select=*&id=eq.${id}`)
  return rows[0] ?? null
}

// "Joe's Plumbing" + id -> "joes-plumbing-<id>". The name is for people and
// Google; only the id is used to look the listing up.
export function serviceSlug(s: Pick<PublicService, 'id' | 'business_name'>): string {
  const name = s.business_name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return name ? `${name}-${s.id}` : s.id
}

export function servicePlace(s: Pick<PublicService, 'suburb' | 'city'>): string {
  return [s.suburb, s.city].filter(Boolean).join(', ')
}
